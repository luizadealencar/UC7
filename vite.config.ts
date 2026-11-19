import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

const projectDirectory = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": "http://127.0.0.1:3001"
    }
  },
  build: {
    target: "esnext",
    rollupOptions: {
      input: Object.fromEntries(
        ["index", "login", "atividade", "alunos", "notas", "aluno"].map((page) => [
          page,
          resolve(projectDirectory, `${page}.html`)
        ])
      )
    }
  }
})