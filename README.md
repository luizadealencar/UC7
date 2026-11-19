# Gavetas — Calendário Escolar

Aplicação web para professores organizarem calendário escolar, atividades, alunos e notas. Os dados são armazenados no `localStorage` do navegador; esta versão não usa um servidor ou banco de dados remoto.

## Funcionalidades

- Calendário mensal com eventos e atividades da turma.
- Cadastro e organização de atividades por matéria, turma e data.
- Cadastro de alunos e importação de planilhas `.xlsx`.
- Registro e consulta de notas.
- Geração e exportação de relatórios de notas.
- Acesso separado para professores e alunos.

## Tecnologias

- HTML, CSS e JavaScript.
- Tailwind CSS 4 com Vite.
- SheetJS para importar planilhas Excel.
- Google Fonts para a fonte Rubik.

## Executar localmente

Requer Node.js e npm. Na raiz do projeto, crie o manifesto npm e instale o Vite e o plugin do Tailwind:

```bash
npm init -y
npm install --save-dev vite tailwindcss @tailwindcss/vite
```

Inicie o servidor de desenvolvimento:

```bash
npx vite --config vite.config.ts
```

Abra no navegador o endereço informado pelo Vite, normalmente `http://localhost:5173`.

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
├── aluno.html
├── alunos.html
├── atividade.html
├── index.html
├── login.html
├── notas.html
└── vite.config.ts
```

## Páginas

- `index.html`: calendário escolar.
- `atividade.html`: cadastro de atividades.
- `alunos.html`: cadastro e importação de alunos.
- `notas.html`: notas e relatórios.
- `aluno.html`: consulta de notas do aluno.
- `login.html`: acesso, cadastro e recuperação de senha.

Como a aplicação usa recursos servidos por CDN (como fontes e SheetJS), é necessária uma conexão com a internet para carregá-los.
