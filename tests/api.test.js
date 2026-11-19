import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../server.js";

async function postJson(baseUrl, route, payload, cookie) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  return { response, body: await response.json() };
}

test("stores teacher data in SQLite and limits student access", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "gavetas-api-"));
  const databasePath = join(directory, "test.sqlite");
  let application = createApp({ databasePath });
  let server = application.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  let baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    application.close();
    await rm(directory, { recursive: true, force: true });
  });

  const teacherRegistration = await postJson(baseUrl, "/api/auth/register", {
    role: "teacher",
    name: "Professora Exemplo",
    email: "professora@example.test",
    password: "senha-segura"
  });
  assert.equal(teacherRegistration.response.status, 201);

  const teacherLogin = await postJson(baseUrl, "/api/auth/login", {
    matricula: teacherRegistration.body.matricula,
    password: "senha-segura",
    role: "teacher"
  });
  assert.equal(teacherLogin.response.status, 200);
  const teacherCookie = teacherLogin.response.headers.get("set-cookie").split(";")[0];

  const initialDataResponse = await fetch(`${baseUrl}/api/data`, {
    headers: { Cookie: teacherCookie }
  });
  const initialData = await initialDataResponse.json();
  assert.equal(initialData.revision, 0);

  const schoolData = {
    activities: [{ id: "activity-1", className: "1ADM1", description: "Prova" }],
    students: [
      { id: "student-1", name: "Ana Exemplo", className: "1ADM1", matricula: "12345678" },
      { id: "student-2", name: "Bia Exemplo", className: "2MSI", matricula: "87654321" }
    ],
    grades: { "activity-1": { "student-1": "9", "student-2": "4" } },
    calendarEvents: [{ id: "event-1", title: "Reunião", date: "2026-12-01", type: "Reunião" }]
  };
  const saveResponse = await fetch(`${baseUrl}/api/data`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: teacherCookie
    },
    body: JSON.stringify({ revision: 0, data: schoolData })
  });
  assert.equal(saveResponse.status, 200);
  assert.equal((await saveResponse.json()).revision, 1);

  const staleSave = await fetch(`${baseUrl}/api/data`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: teacherCookie
    },
    body: JSON.stringify({ revision: 0, data: schoolData })
  });
  assert.equal(staleSave.status, 409);

  const studentRegistration = await postJson(baseUrl, "/api/auth/register", {
    role: "student",
    name: "Ana Exemplo",
    email: "ana@example.test",
    password: "senha-aluna",
    matricula: "12345678"
  });
  assert.equal(studentRegistration.response.status, 201);

  const studentLogin = await postJson(baseUrl, "/api/auth/login", {
    matricula: "12345678",
    password: "senha-aluna",
    role: "student"
  });
  const studentCookie = studentLogin.response.headers.get("set-cookie").split(";")[0];
  const studentDataResponse = await fetch(`${baseUrl}/api/data`, {
    headers: { Cookie: studentCookie }
  });
  const studentData = await studentDataResponse.json();
  assert.deepEqual(studentData.data.students.map((student) => student.id), ["student-1"]);
  assert.deepEqual(studentData.data.grades["activity-1"], { "student-1": "9" });

  const forbiddenSave = await fetch(`${baseUrl}/api/data`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: studentCookie
    },
    body: JSON.stringify({ revision: 1, data: schoolData })
  });
  assert.equal(forbiddenSave.status, 403);

  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  application.close();
  application = createApp({ databasePath });
  server = application.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const persistedDataResponse = await fetch(`${baseUrl}/api/data`, {
    headers: { Cookie: teacherCookie }
  });
  assert.equal(persistedDataResponse.status, 200);
  const persistedData = await persistedDataResponse.json();
  assert.equal(persistedData.revision, 1);
  assert.deepEqual(persistedData.data, schoolData);
});
