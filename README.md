# Gavetas — Calendário Escolar

Aplicação web para professores organizarem calendário escolar, atividades, alunos e notas. O servidor Node.js usa um banco PostgreSQL hospedado no Supabase para compartilhar os dados entre os dispositivos.

## Funcionalidades

- Calendário mensal com eventos e atividades.
- Cadastro e organização de atividades por matéria, turma e data.
- Cadastro de alunos e importação de planilhas `.xlsx`.
- Registro e consulta de notas, com geração e exportação de relatórios.
- Acesso separado para professores e alunos.
- Modos claro e escuro, com preferência salva no navegador.
- Persistência centralizada no Supabase.

## Tecnologias

- HTML, CSS e JavaScript.
- Node.js, Express e PostgreSQL (`pg`).
- Supabase Database.
- Vite e Tailwind CSS 4.
- SheetJS para importar planilhas Excel.

## Configurar o Supabase

1. Crie um projeto no [Supabase](https://supabase.com/).
2. No painel do projeto, abra **SQL Editor**, copie o conteúdo de `supabase/schema.sql` e execute-o. Isso cria as tabelas e habilita Row Level Security sem políticas públicas.
3. Na área **Connect** do projeto, copie uma connection string PostgreSQL. Para conexões a partir de redes IPv4, use a string do pooler recomendada pelo Supabase.
4. Na raiz do projeto, crie seu arquivo local `.env` a partir do exemplo:

   ```powershell
   Copy-Item .env.example .env
   ```

5. Edite `.env` e substitua `DATABASE_URL` pela connection string do Supabase. Preserve `sslmode=require`; substitua os dados de exemplo pelo projeto e senha corretos.

**Nunca compartilhe nem envie o `.env` ao GitHub.** A string contém credenciais do banco. O `.env` já está ignorado pelo Git; somente `.env.example`, sem segredos, deve ser versionado.

## Executar localmente

Requer Node.js 22 ou superior. No computador que será o servidor, na raiz deste projeto:

```powershell
npm install
npm run dev
```

O Vite mostrará os endereços disponíveis. Nos outros computadores da mesma rede, abra o endereço `Network` informado pelo Vite. Se o Windows Firewall perguntar, permita conexões na rede privada. Não exponha a aplicação à internet pública sem HTTPS e controles adicionais.

Crie uma conta de professor na página de cadastro. O sistema mostrará uma matrícula e um código de recuperação; guarde ambos. Para criar uma conta de aluno, primeiro cadastre o aluno e sua matrícula na aplicação.

O comando `npm run dev` inicia a API na porta `3001` e o Vite na porta `5173`. Ambos precisam permanecer ativos durante o uso.

### Executar a versão de produção

```powershell
npm run build
npm start
```

O servidor Express serve a aplicação e a API na porta `5173`. Para acesso na rede local, outros computadores podem abrir `http://<IP-do-computador-servidor>:5173`.

## Publicar na internet

O Supabase hospeda o banco de dados, mas não executa esta API Node.js. Para disponibilizar o app publicamente, também é necessário hospedar o servidor Node em uma plataforma compatível. Configure `DATABASE_URL` como variável secreta nessa plataforma e defina `COOKIE_SECURE=true` quando o site estiver servido por HTTPS. GitHub Pages sozinho não executa a API.

## Dados existentes

Dados que já estejam no antigo arquivo SQLite não são transferidos automaticamente para o Supabase. A importação antiga do navegador continua disponível quando o cadastro de professor encontra os dados locais que o app já reconhece; ela não importa automaticamente usuários ou bancos SQLite existentes. Mantenha uma cópia segura do banco antigo antes de qualquer migração manual.

## Estrutura

```text
UC7/
├── css/
│   └── style.css
├── img/
│   └── logo.png
├── js/
│   ├── auth.js
│   └── script.js
├── supabase/
│   └── schema.sql
├── tests/
│   └── api.test.js
├── .env.example
├── aluno.html
├── alunos.html
├── atividade.html
├── index.html
├── login.html
├── notas.html
├── package.json
├── package-lock.json
├── server.js
└── vite.config.ts
```

## Páginas

- `index.html`: calendário escolar.
- `atividade.html`: cadastro de atividades.
- `alunos.html`: cadastro e importação de alunos.
- `notas.html`: notas e relatórios.
- `aluno.html`: consulta de notas do aluno.
- `login.html`: acesso, cadastro e recuperação de senha.

A interface também usa recursos de CDN, como Google Fonts e SheetJS, portanto é necessária uma conexão com a internet para carregá-los.

## Testes

```powershell
npm test
```

Os testes usam um PostgreSQL em memória e não precisam conectar ao projeto Supabase.
