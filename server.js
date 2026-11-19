import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";
import express from "express";

const { Pool } = pg;
const projectDirectory = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(projectDirectory, "supabase", "schema.sql");
const defaultStaticDirectory = resolve(projectDirectory, "dist");
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

function hashPayload(payload) {
  if (typeof payload === "string") return JSON.parse(payload);
  return payload;
}

function getCookie(request, name) {
  const pair = (request.headers.cookie || "").split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!pair) return "";
  try {
    return decodeURIComponent(pair.slice(name.length + 1));
  } catch {
    return "";
  }
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

async function createMatricula(queryable) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const matricula = String(randomInt(10000000, 100000000));
    const result = await queryable.query("SELECT 1 FROM public.users WHERE matricula = $1", [matricula]);
    if (result.rowCount === 0) return matricula;
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

async function executeTransaction(pool, callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createApp({
  pool: suppliedPool,
  databaseUrl = process.env.DATABASE_URL,
  staticDirectory = null,
  initializeSchema = true
} = {}) {
  if (!suppliedPool && !databaseUrl) {
    throw new Error("Configure DATABASE_URL no arquivo .env com a conexão PostgreSQL do Supabase.");
  }

  const pool = suppliedPool || new Pool({ connectionString: databaseUrl, max: 10 });
  try {
    if (initializeSchema) {
      const schema = await readFile(schemaPath, "utf8");
      await pool.query(schema);
    } else {
      await pool.query("SELECT 1");
    }
  } catch (error) {
    if (!suppliedPool) await pool.end();
    throw error;
  }

  const app = express();
  app.use(express.json({ limit: "10mb" }));

  app.use(async (request, _response, next) => {
    const rawToken = getCookie(request, SESSION_COOKIE);
    if (!rawToken) return next();

    try {
      const result = await pool.query(`
        SELECT users.id, users.email, users.name, users.matricula, users.role,
          users.teacher_id, users.student_id
        FROM public.sessions
        JOIN public.users ON public.users.id = public.sessions.user_id
        WHERE public.sessions.token_hash = $1 AND public.sessions.expires_at > $2
      `, [hashValue(rawToken), Math.floor(Date.now() / 1000)]);
      if (result.rows[0]) request.user = result.rows[0];
      next();
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/register", async (request, response, next) => {
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
        const teachers = await pool.query("SELECT teacher_id, payload FROM public.teacher_data");
        for (const teacher of teachers.rows) {
          const student = hashPayload(teacher.payload).students.find((candidate) =>
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
      }

      const recoveryCode = randomBytes(12).toString("hex").toUpperCase();
      const user = await executeTransaction(pool, async (client) => {
        const newMatricula = role === "teacher" ? await createMatricula(client) : matricula;
        const inserted = await client.query(`
          INSERT INTO public.users
            (email, name, matricula, role, password_hash, recovery_hash, teacher_id, student_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, email, name, matricula, role, teacher_id, student_id
        `, [
          cleanEmail,
          cleanName,
          newMatricula,
          role,
          hashPassword(password),
          hashValue(recoveryCode),
          teacherId,
          studentId
        ]);
        if (role === "teacher") {
          await client.query(
            "INSERT INTO public.teacher_data (teacher_id, payload) VALUES ($1, $2::jsonb)",
            [inserted.rows[0].id, JSON.stringify(EMPTY_TEACHER_DATA)]
          );
        }
        return inserted.rows[0];
      });

      response.status(201).json({
        user: publicUser(user),
        matricula: user.matricula,
        recoveryCode
      });
    } catch (error) {
      if (error.code === "23505") {
        return response.status(409).json({ error: "Este e-mail ou matrícula já possui um cadastro." });
      }
      next(error);
    }
  });

  app.post("/api/auth/login", async (request, response, next) => {
    try {
      const { matricula, password, role } = request.body || {};
      if (typeof matricula !== "string" || typeof password !== "string"
        || (role !== "teacher" && role !== "student")) {
        throw new HttpError(400, "Informe matrícula, senha e tipo de acesso.");
      }
      const result = await pool.query(`
        SELECT id, email, name, matricula, role, password_hash, teacher_id, student_id
        FROM public.users WHERE matricula = $1 AND role = $2
      `, [matricula.trim(), role]);
      const user = result.rows[0];
      if (!user || !verifyPassword(password, user.password_hash)) {
        throw new HttpError(401, "Matrícula ou senha inválida.");
      }

      const rawToken = randomBytes(32).toString("base64url");
      const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
      await pool.query(
        "INSERT INTO public.sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
        [hashValue(rawToken), user.id, expiresAt]
      );
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

  app.post("/api/auth/logout", async (request, response, next) => {
    try {
      const rawToken = getCookie(request, SESSION_COOKIE);
      if (rawToken) {
        await pool.query("DELETE FROM public.sessions WHERE token_hash = $1", [hashValue(rawToken)]);
      }
      response.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/reset-password", async (request, response, next) => {
    try {
      const { email, recoveryCode, password } = request.body || {};
      const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
      if (typeof password !== "string" || password.length < 6 || password.length > 256
        || typeof recoveryCode !== "string") {
        throw new HttpError(400, "Informe o código de recuperação e uma nova senha válida.");
      }
      const result = await pool.query(
        "SELECT id, recovery_hash FROM public.users WHERE email = $1",
        [cleanEmail]
      );
      const user = result.rows[0];
      const expected = Buffer.from(user?.recovery_hash || "0".repeat(64), "hex");
      const actual = Buffer.from(hashValue(recoveryCode.trim().toUpperCase()), "hex");
      if (!user || expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        throw new HttpError(400, "E-mail ou código de recuperação inválido.");
      }
      const newRecoveryCode = randomBytes(12).toString("hex").toUpperCase();
      await executeTransaction(pool, async (client) => {
        await client.query(
          "UPDATE public.users SET password_hash = $1, recovery_hash = $2 WHERE id = $3",
          [hashPassword(password), hashValue(newRecoveryCode), user.id]
        );
        await client.query("DELETE FROM public.sessions WHERE user_id = $1", [user.id]);
      });
      response.json({ recoveryCode: newRecoveryCode });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/auth/session", (request, response) => {
    if (!request.user) return response.status(401).json({ error: "Sessão encerrada." });
    response.json(publicUser(request.user));
  });

  app.get("/api/data", async (request, response, next) => {
    try {
      if (!request.user) return response.status(401).json({ error: "Entre na sua conta para continuar." });
      const teacherId = request.user.role === "student" ? request.user.teacher_id : request.user.id;
      const result = await pool.query(
        "SELECT payload, revision FROM public.teacher_data WHERE teacher_id = $1",
        [teacherId]
      );
      const row = result.rows[0];
      const data = row ? hashPayload(row.payload) : structuredClone(EMPTY_TEACHER_DATA);

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
            .map(([activityId, grades]) => [
              activityId,
              { [request.user.student_id]: grades[request.user.student_id] }
            ])
        );
      }
      response.json({ revision: row?.revision || 0, data });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/data", async (request, response, next) => {
    try {
      if (!request.user) throw new HttpError(401, "Entre na sua conta para continuar.");
      if (request.user.role !== "teacher") {
        throw new HttpError(403, "Somente professores podem alterar os dados.");
      }
      const { revision, data } = request.body || {};
      if (!Number.isInteger(revision) || revision < 0 || !validateTeacherData(data)) {
        throw new HttpError(400, "Os dados enviados estão incompletos ou inválidos.");
      }
      const serializedData = JSON.stringify(data);
      if (Buffer.byteLength(serializedData, "utf8") > 8 * 1024 * 1024) {
        throw new HttpError(413, "O conjunto de dados é grande demais para salvar.");
      }

      const nextRevision = await executeTransaction(pool, async (client) => {
        const current = await client.query(
          "SELECT revision FROM public.teacher_data WHERE teacher_id = $1 FOR UPDATE",
          [request.user.id]
        );
        const currentRevision = current.rows[0]?.revision || 0;
        if (currentRevision !== revision) {
          throw new HttpError(409, "Os dados foram alterados em outra tela. Atualize a página antes de salvar novamente.");
        }
        const next = currentRevision + 1;
        await client.query(`
          INSERT INTO public.teacher_data (teacher_id, payload, revision, updated_at)
          VALUES ($1, $2::jsonb, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (teacher_id) DO UPDATE SET
            payload = EXCLUDED.payload,
            revision = EXCLUDED.revision,
            updated_at = CURRENT_TIMESTAMP
        `, [request.user.id, serializedData, next]);
        return next;
      });
      response.json({ revision: nextRevision });
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

  return { app, pool, close: () => pool.end() };
}

const isMainModule = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMainModule) {
  const apiOnly = process.argv.includes("--api-only");
  createApp({
    staticDirectory: apiOnly ? null : defaultStaticDirectory
  }).then(({ app, pool }) => {
    const port = apiOnly ? 3001 : Number(process.env.PORT || 5173);
    const host = apiOnly ? "127.0.0.1" : process.env.HOST || "0.0.0.0";
    const server = app.listen(port, host, () => {
      console.log(`Gavetas disponível em http://${host}:${port}`);
    });
    const shutdown = () => {
      server.close(() => pool.end().then(() => process.exit(0)));
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  }).catch((error) => {
    console.error("Não foi possível iniciar o servidor. Confira DATABASE_URL e a conexão com o Supabase.", error);
    process.exitCode = 1;
  });
}
