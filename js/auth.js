const AUTH_ACCOUNTS_KEY = "gavetas-professores";
const AUTH_SESSION_KEY = "gavetas-sessao";

function carregarContas() {
  const contasSalvas = localStorage.getItem(AUTH_ACCOUNTS_KEY);
  if (!contasSalvas) return [];

  try {
    const contas = JSON.parse(contasSalvas);
    return Array.isArray(contas) ? contas : [];
  } catch (error) {
    console.error("Não foi possível carregar as contas locais.", error);
    return [];
  }
}

function salvarContas(contas) {
  localStorage.setItem(AUTH_ACCOUNTS_KEY, JSON.stringify(contas));
}

async function gerarHash(valor) {
  const dados = new TextEncoder().encode(valor);
  const hash = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function gerarMatricula(contas) {
  let matricula;
  do {
    matricula = String(Math.floor(10000000 + Math.random() * 90000000));
  } while (contas.some((conta) => conta.matricula === matricula));
  return matricula;
}

function encontrarAluno(matricula, nome) {
  for (let indice = 0; indice < localStorage.length; indice += 1) {
    const chave = localStorage.key(indice);
    if (!chave || !chave.startsWith("gavetaDeAlunos-")) continue;
    try {
      const banco = JSON.parse(localStorage.getItem(chave));
      const aluno = (banco.students || []).find((item) =>
        item.matricula === matricula &&
        item.name.trim().toLowerCase() === nome.trim().toLowerCase()
      );
      if (aluno) return { aluno, teacherKey: chave };
    } catch (error) {
      console.error("Não foi possível verificar o cadastro de aluno.", error);
    }
  }
  return null;
}

function obterSessao() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || "null");
  } catch (error) {
    console.error("Não foi possível ler a sessão local.", error);
    return null;
  }
}

function mostrarMensagem(elemento, mensagem, tipo) {
  elemento.textContent = mensagem;
  elemento.className = `auth-message ${tipo || ""}`;
}

function configurarAbas() {
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".auth-tab, .auth-form").forEach((elemento) => {
        elemento.classList.remove("active");
      });
      tab.classList.add("active");
      document.querySelector(`#${tab.dataset.form}`).classList.add("active");
    });
  });
}

if (document.body.dataset.authPage === "login") {
  configurarAbas();

  const loginForm = document.querySelector("#login-form");
  const registerForm = document.querySelector("#register-form");
  const forgotForm = document.querySelector("#forgot-form");
  const authMessage = document.querySelector("#auth-message");
  const registrationResult = document.querySelector("#registration-result");
  const loginRole = document.querySelector("#login-role");
  const registerRole = document.querySelector("#register-role");
  const studentRegistrationFields = document.querySelector("#student-registration-fields");
  const studentMatriculaInput = document.querySelector("#register-student-matricula");
  const forgotPasswordLink = document.querySelector("#forgot-password-link");
  const backToLogin = document.querySelector("#back-to-login");

  forgotPasswordLink.addEventListener("click", (event) => {
    event.preventDefault();
    document.querySelectorAll(".auth-tab, .auth-form").forEach((elemento) => {
      elemento.classList.remove("active");
    });
    forgotForm.classList.add("active");
  });

  backToLogin.addEventListener("click", (event) => {
    event.preventDefault();
    document.querySelectorAll(".auth-tab, .auth-form").forEach((elemento) => {
      elemento.classList.remove("active");
    });
    document.querySelector('[data-form="login-form"]').classList.add("active");
    loginForm.classList.add("active");
  });

  registerRole.addEventListener("change", () => {
    const isStudent = registerRole.value === "student";
    studentRegistrationFields.hidden = !isStudent;
    studentMatriculaInput.required = isStudent;
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const matricula = document.querySelector("#login-matricula").value.trim();
    const senha = document.querySelector("#login-password").value;
    const conta = carregarContas().find((item) =>
      item.matricula === matricula &&
      (item.role || "teacher") === loginRole.value
    );

    if (!conta || conta.passwordHash !== await gerarHash(senha)) {
      mostrarMensagem(authMessage, "Matrícula ou senha inválida.", "error");
      return;
    }

    if ((conta.role || "teacher") === "teacher") {
      const dadosDaConta = `gavetaDeAlunos-${conta.matricula}`;
      const dadosLegados = localStorage.getItem("gavetaDeAlunos");
      if (!localStorage.getItem(dadosDaConta) && dadosLegados) {
        localStorage.setItem(dadosDaConta, dadosLegados);
      }
    }

    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
      matricula: conta.matricula,
      name: conta.name,
      email: conta.email,
      role: conta.role || "teacher",
      studentId: conta.studentId || "",
      teacherKey: conta.teacherKey || ""
    }));
    window.location.href = (conta.role || "teacher") === "student"
      ? "aluno.html"
      : "index.html";
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.querySelector("#register-email").value.trim().toLowerCase();
    const name = document.querySelector("#register-name").value.trim();
    const senha = document.querySelector("#register-password").value;
    const contas = carregarContas();
    const role = registerRole.value;

    if (contas.some((conta) => conta.email === email)) {
      mostrarMensagem(authMessage, "Este e-mail já está cadastrado.", "error");
      return;
    }

    if (role === "student") {
      const studentMatricula = studentMatriculaInput.value.trim();
      const cadastroAluno = encontrarAluno(studentMatricula, name);
      if (!cadastroAluno) {
        mostrarMensagem(authMessage, "Confira a matrícula e o nome cadastrados pelo professor.", "error");
        return;
      }
      if (contas.some((conta) => conta.matricula === studentMatricula)) {
        mostrarMensagem(authMessage, "Esta matrícula já possui um login.", "error");
        return;
      }
      contas.push({
        email,
        name,
        matricula: studentMatricula,
        role,
        studentId: cadastroAluno.aluno.id,
        teacherKey: cadastroAluno.teacherKey,
        passwordHash: await gerarHash(senha)
      });
    } else {
      const matricula = gerarMatricula(contas);
      contas.push({ email, name, matricula, role, passwordHash: await gerarHash(senha) });
      registrationResult.hidden = false;
      registrationResult.innerHTML = `Cadastro concluído. Sua matrícula é <strong>${matricula}</strong>. Guarde este número para entrar.`;
    }
    salvarContas(contas);
    registerForm.reset();
    studentRegistrationFields.hidden = true;
    studentMatriculaInput.required = false;
    mostrarMensagem(authMessage, "Cadastro realizado com sucesso.", "success");
  });

  forgotForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.querySelector("#forgot-email").value.trim().toLowerCase();
    const novaSenha = document.querySelector("#forgot-password").value;
    const contas = carregarContas();
    const conta = contas.find((item) => item.email === email);

    if (!conta) {
      mostrarMensagem(authMessage, "Não encontramos uma conta com este e-mail.", "error");
      return;
    }

    conta.passwordHash = await gerarHash(novaSenha);
    salvarContas(contas);
    forgotForm.reset();
    mostrarMensagem(authMessage, "Senha restaurada. Você já pode entrar com sua matrícula.", "success");
  });
} else {
  const sessao = obterSessao();
  if (!sessao) {
    window.location.replace("login.html");
  } else {
    const paginaAtual = window.location.pathname.split(/[\\/]/).pop() || "index.html";
    const isStudentPage = paginaAtual === "aluno.html";
    if (sessao.role === "student" && !isStudentPage) {
      window.location.replace("aluno.html");
    } else if (sessao.role !== "student" && isStudentPage) {
      window.location.replace("index.html");
    }
    window.currentProfessor = sessao;
    const logoutButton = document.querySelector("#logout-button");
    if (logoutButton) {
      logoutButton.addEventListener("click", () => {
        localStorage.removeItem(AUTH_SESSION_KEY);
        window.location.href = "login.html";
      });
    }
  }
}
