import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Database from "better-sqlite3";
import express from "express";

const projectDirectory = dirname(fileURLToPath(import.meta.url));
const defaultDatabasePath = process.env.DB_PATH || join(projectDirectory, "data", "gavetas.sqlite");
const defaultStaticDirectory = join(projectDirectory, "dist");
const SESSION_COOKIE = "gavetas_session";
const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;
const EMPTY_TEACHER_DATA = {
  activities: [],
  students: [],
  grades: {},
  calendarEvents: []
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function hashValue(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const [algorithm, salt, expectedHash] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHash) return false;
  const actualHash = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, "hex");
  return actualHash.length === expected.length && timingSafeEqual(actualHash, expected);
}

function getCookie(request, name) {
  const cookies = request.headers.cookie || "";
  const pair = cookies.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : "";
}

function publicUser(user) {
  return {
    matricula: user.matricula,
    name: user.name,
    email: user.email,
    role: user.role,
    studentId: user.student_id || ""
  };
}

function createMatricula(database) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const matricula = String(randomInt(10000000, 100000000));
    if (!database.prepare("SELECT 1 FROM users WHERE matricula = ?").get(matricula)) {
      return matricula;
    }
  }
  throw new HttpError(503, "Não foi possível gerar uma matrícula. Tente novamente.");
}

function validateTeacherData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Array.isArray(value.activities)
    && Array.isArray(value.students)
    && Array.isArray(value.calendarEvents)
    && value.grades !== null
    && typeof value.grades === "object"
    && !Array.isArray(value.grades);
}

export function createApp({
  databasePath = defaultDatabasePath,
  staticDirectory = null
} = {}) {
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      matricula TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
      password_hash TEXT NOT NULL,
      recovery_hash TEXT NOT NULL,
      teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      student_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS teacher_data (
      teacher_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      payload TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
  `);

  const app = express();
  app.use(express.json({ limit: "10mb" }));

  app.use((request, _response, next) => {
    const rawToken = getCookie(request, SESSION_COOKIE);
    if (!rawToken) return next();

    const session = database.prepare(`
      SELECT users.id, users.email, users.name, users.matricula, users.role,
        users.teacher_id, users.student_id
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    `).get(hashValue(rawToken), Math.floor(Date.now() / 1000));

    if (session) request.user = session;
    next();
  });

  app.post("/api/auth/register", (request, response, next) => {
    try {
      const { name, email, password, role, matricula: studentMatricula } = request.body || {};
      const cleanName = typeof name === "string" ? name.trim() : "";
      const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
      if (!cleanName || cleanName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new HttpError(400, "Informe um nome e um e-mail válidos.");
      }
      if (typeof password !== "string" || password.length < 6 || password.length > 256) {
        throw new HttpError(400, "A senha deve ter entre 6 e 256 caracteres.");
      }
      if (role !== "teacher" && role !== "student") {
        throw new HttpError(400, "Selecione professor ou aluno.");
      }

      let teacherId = null;
      let studentId = null;
      let matricula;
      if (role === "student") {
        if (typeof studentMatricula !== "string" || !/^\d{8}$/.test(studentMatricula)) {
          throw new HttpError(400, "Informe a matrícula de 8 dígitos do aluno.");
        }
        const teachers = database.prepare("SELECT teacher_id, payload FROM teacher_data").all();
        for (const teacher of teachers) {
          const student = JSON.parse(teacher.payload).students.find((candidate) =>
            candidate.matricula === studentMatricula
            && String(candidate.name || "").trim().toLocaleLowerCase("pt-BR")
              === cleanName.toLocaleLowerCase("pt-BR")
          );
          if (student) {
            teacherId = teacher.teacher_id;
            studentId = student.id;
            break;
          }
        }
        if (!teacherId) {
          throw new HttpError(400, "Confira a matrícula e o nome cadastrados pelo professor.");
        }
        matricula = studentMatricula;
      } else {
        matricula = createMatricula(database);
      }

      const recoveryCode = randomBytes(12).toString("hex").toUpperCase();
      const createUser = database.transaction(() => {
        const result = database.prepare(`
          INSERT INTO users (email, name, matricula, role, password_hash, recovery_hash, teacher_id, student_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          cleanEmail,
          cleanName,
          matricula,
          role,
          hashPassword(password),
          hashValue(recoveryCode),
          teacherId,
          studentId
        );
        if (role === "teacher") {
          database.prepare("INSERT INTO teacher_data (teacher_id, payload) VALUES (?, ?)")
            .run(result.lastInsertRowid, JSON.stringify(EMPTY_TEACHER_DATA));
        }
        return database.prepare(`
          SELECT id, email, name, matricula, role, teacher_id, student_id
          FROM users WHERE id = ?
        `).get(result.lastInsertRowid);
      });

      const user = createUser();
      response.status(201).json({
        user: publicUser(user),
        matricula,
        recoveryCode
      });
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return response.status(409).json({ error: "Este e-mail ou matrícula já possui um cadastro." });
      }
      next(error);
    }
  });

  app.post("/api/auth/login", (request, response, next) => {
    try {
      const { matricula, password, role } = request.body || {};
      if (typeof matricula !== "string" || typeof password !== "string"
        || (role !== "teacher" && role !== "student")) {
        throw new HttpError(400, "Informe matrícula, senha e tipo de acesso.");
      }
      const user = database.prepare(`
        SELECT id, email, name, matricula, role, password_hash, teacher_id, student_id
        FROM users WHERE matricula = ? AND role = ?
      `).get(matricula.trim(), role);
      if (!user || !verifyPassword(password, user.password_hash)) {
        throw new HttpError(401, "Matrícula ou senha inválida.");
      }

      const rawToken = randomBytes(32).toString("base64url");
      const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
      database.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
        .run(hashValue(rawToken), user.id, expiresAt);
      const secure = process.env.COOKIE_SECURE === "true" ? "; Secure" : "";
      response.setHeader(
        "Set-Cookie",
        `${SESSION_COOKIE}=${encodeURIComponent(rawToken)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DURATION_SECONDS}${secure}`
      );
      response.json(publicUser(user));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/logout", (request, response) => {
    const rawToken = getCookie(request, SESSION_COOKIE);
    if (rawToken) {
      database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashValue(rawToken));
    }
    response.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    response.status(204).end();
  });

  app.post("/api/auth/reset-password", (request, response, next) => {
    try {
      const { email, recoveryCode, password } = request.body || {};
      const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
      if (typeof password !== "string" || password.length < 6 || password.length > 256
        || typeof recoveryCode !== "string") {
        throw new HttpError(400, "Informe o código de recuperação e uma nova senha válida.");
      }
      const user = database.prepare("SELECT id, recovery_hash FROM users WHERE email = ?").get(cleanEmail);
      const candidate = hashValue(recoveryCode.trim().toUpperCase());
      const expected = Buffer.from(user?.recovery_hash || "0".repeat(64), "hex");
      const actual = Buffer.from(candidate, "hex");
      if (!user || expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        throw new HttpError(400, "E-mail ou código de recuperação inválido.");
      }
      const newRecoveryCode = randomBytes(12).toString("hex").toUpperCase();
      database.prepare("UPDATE users SET password_hash = ?, recovery_hash = ? WHERE id = ?")
        .run(hashPassword(password), hashValue(newRecoveryCode), user.id);
      database.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
      response.json({ recoveryCode: newRecoveryCode });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/auth/session", (request, response) => {
    if (!request.user) return response.status(401).json({ error: "Sessão encerrada." });
    response.json(publicUser(request.user));
  });

  app.get("/api/data", (request, response) => {
    if (!request.user) return response.status(401).json({ error: "Entre na sua conta para continuar." });
    const teacherId = request.user.role === "student" ? request.user.teacher_id : request.user.id;
    const row = database.prepare("SELECT payload, revision FROM teacher_data WHERE teacher_id = ?")
      .get(teacherId);
    const data = row ? JSON.parse(row.payload) : structuredClone(EMPTY_TEACHER_DATA);

    if (request.user.role === "student") {
      const student = data.students.find((item) => item.id === request.user.student_id);
      const studentActivities = student
        ? data.activities.filter((item) => item.className === student.className)
        : [];
      const activityIds = new Set(studentActivities.map((item) => item.id));
      data.students = student ? [student] : [];
      data.activities = studentActivities;
      data.grades = Object.fromEntries(
        Object.entries(data.grades)
          .filter(([activityId]) => activityIds.has(activityId))
          .map(([activityId, grades]) => [activityId, { [request.user.student_id]: grades[request.user.student_id] }])
      );
    }
    response.json({ revision: row?.revision || 0, data });
  });

  app.put("/api/data", (request, response, next) => {
    try {
      if (!request.user) throw new HttpError(401, "Entre na sua conta para continuar.");
      if (request.user.role !== "teacher") throw new HttpError(403, "Somente professores podem alterar os dados.");
      const { revision, data } = request.body || {};
      if (!Number.isInteger(revision) || revision < 0 || !validateTeacherData(data)) {
        throw new HttpError(400, "Os dados enviados estão incompletos ou inválidos.");
      }
      const serializedData = JSON.stringify(data);
      if (Buffer.byteLength(serializedData, "utf8") > 8 * 1024 * 1024) {
        throw new HttpError(413, "O conjunto de dados é grande demais para salvar.");
      }

      const save = database.transaction(() => {
        const current = database.prepare("SELECT revision FROM teacher_data WHERE teacher_id = ?")
          .get(request.user.id);
        const currentRevision = current?.revision || 0;
        if (currentRevision !== revision) {
          throw new HttpError(409, "Os dados foram alterados em outra tela. Atualize a página antes de salvar novamente.");
        }
        const nextRevision = currentRevision + 1;
        database.prepare(`
          INSERT INTO teacher_data (teacher_id, payload, revision, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(teacher_id) DO UPDATE SET
            payload = excluded.payload,
            revision = excluded.revision,
            updated_at = CURRENT_TIMESTAMP
        `).run(request.user.id, serializedData, nextRevision);
        return nextRevision;
      });
      response.json({ revision: save() });
    } catch (error) {
      next(error);
    }
  });

  if (staticDirectory) {
    app.use(express.static(resolve(staticDirectory), { index: "index.html" }));
  }

  app.use((error, _request, response, _next) => {
    if (response.headersSent) return;
    if (error instanceof HttpError) {
      return response.status(error.status).json({ error: error.message });
    }
    console.error("Erro não esperado na API.", error);
    response.status(500).json({ error: "Ocorreu um erro interno. Tente novamente." });
  });

  return { app, database, close: () => database.close() };
}

const isMainModule = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMainModule) {
  const apiOnly = process.argv.includes("--api-only");
  const { app } = createApp({
    staticDirectory: apiOnly ? null : defaultStaticDirectory
  });
  const port = Number(process.env.PORT || (apiOnly ? 3001 : 5173));
  const host = process.env.HOST || (apiOnly ? "127.0.0.1" : "0.0.0.0");
  app.listen(port, host, () => {
    console.log(`Gavetas disponível em http://${host}:${port}`);
  });
}
