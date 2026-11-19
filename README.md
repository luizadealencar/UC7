# Gavetas — Calendário Escolar

Aplicação web para professores organizarem calendário escolar, atividades, alunos e notas. O servidor usa SQLite para guardar os cadastros e os dados da turma no computador que hospeda a aplicação.

## Funcionalidades

- Calendário mensal com eventos e atividades.
- Cadastro e organização de atividades por matéria, turma e data.
- Cadastro de alunos e importação de planilhas `.xlsx`.
- Registro e consulta de notas, com geração e exportação de relatórios.
- Acesso separado para professores e alunos.
- Armazenamento centralizado para acesso por outros computadores da mesma rede local.

## Tecnologias

- HTML, CSS e JavaScript.
- Node.js, Express e SQLite (`better-sqlite3`).
- Vite e Tailwind CSS 4.
- SheetJS para importar planilhas Excel.

## Executar na rede local

Requer Node.js 22 ou superior. No computador que será o servidor, na raiz deste projeto:

```bash
npm install
npm run dev
```

O Vite mostrará os endereços disponíveis. Nos outros computadores da mesma rede, abra o endereço `Network` informado pelo Vite. Se o Windows Firewall perguntar, permita conexões na rede privada. Não exponha a aplicação à internet pública sem configurar HTTPS e controles adicionais.

Crie uma conta de professor na página de cadastro. O sistema mostrará uma matrícula e um código de recuperação; guarde ambos. Para criar uma conta de aluno, primeiro cadastre o aluno e sua matrícula na aplicação.

Os dados ficam no arquivo `data/gavetas.sqlite` no computador servidor. O arquivo não deve ser enviado ao GitHub. Para fazer uma cópia de segurança, pare o servidor e copie esse arquivo para um local seguro.

### Executar a versão de produção

```bash
npm run build
npm start
```

Depois, outros computadores podem acessar `http://<IP-do-computador-servidor>:5173`.

## Dados da versão anterior

Ao cadastrar um professor com o mesmo e-mail de uma conta antiga neste navegador, os dados locais associados a essa conta serão importados no primeiro acesso. Os dados antigos não são apagados do navegador. Faça também uma cópia de segurança antes da migração.

## Estrutura

```text
UC7/
├── css/
│   └── style.css
├── data/                 # banco SQLite local; ignorado pelo Git
├── img/
│   └── logo.png
├── js/
│   ├── auth.js
│   └── script.js
├── tests/
│   └── api.test.js
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
