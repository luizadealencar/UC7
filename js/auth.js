function mostrarMensagem(elemento, mensagem, tipo) {
  elemento.textContent = mensagem;
  elemento.className = `auth-message ${tipo || ""}`;
}

async function enviarRequisicao(url, dados) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados)
  });
  const resultado = response.status === 204 ? {} : await response.json();
  if (!response.ok) {
    throw new Error(resultado.error || "Não foi possível concluir a operação.");
  }
  return resultado;
}

function prepararImportacaoLocal(email) {
  try {
    const accounts = JSON.parse(localStorage.getItem("gavetas-professores") || "[]");
    const previousAccount = accounts.find((account) =>
      account.email?.toLowerCase() === email && (account.role || "teacher") === "teacher"
    );
    if (!previousAccount) return { data: null, error: null };

    const savedData = localStorage.getItem(`gavetaDeAlunos-${previousAccount.matricula}`)
      || localStorage.getItem("gavetaDeAlunos");
    if (!savedData) return { data: null, error: null };

    const previousData = JSON.parse(savedData);
    const students = Array.isArray(previousData.students) ? previousData.students.map((student, index) => (
      typeof student === "string"
        ? { id: `aluno-antigo-${index + 1}`, name: student, className: "", matricula: "" }
        : { ...student, matricula: student.matricula || "" }
    )) : [];
    const grades = {};
    Object.entries(previousData.grades && typeof previousData.grades === "object"
      ? previousData.grades
      : {}).forEach(([activityId, values]) => {
      if (Array.isArray(values)) {
        grades[activityId] = {};
        values.forEach((grade, index) => {
          if (grade !== "" && grade !== null && grade !== undefined) {
            grades[activityId][students[index]?.id || `aluno-antigo-${index + 1}`] = grade;
          }
        });
      } else {
        grades[activityId] = values;
      }
    });

    return {
      data: {
        activities: Array.isArray(previousData.activities) ? previousData.activities : [],
        students,
        grades,
        calendarEvents: Array.isArray(previousData.calendarEvents) ? previousData.calendarEvents : []
      },
      error: null
    };
  } catch (error) {
    console.error("Não foi possível preparar a importação dos dados locais.", error);
    return {
      data: null,
      error: "Os dados antigos deste navegador não puderam ser lidos e não foram apagados."
    };
  }
}

async function importarDadosLocaisPendentes(user) {
  if (user.role !== "teacher") return null;
  const pendingKey = `gavetas-importacao-pendente-${user.matricula}`;
  const savedData = localStorage.getItem(pendingKey);
  if (!savedData) return null;

  const data = JSON.parse(savedData);
  const currentResponse = await fetch("/api/data");
  const current = await currentResponse.json();
  if (!currentResponse.ok) {
    throw new Error(current.error || "Não foi possível verificar os dados do servidor.");
  }
  if (current.revision !== 0) {
    return "A importação local foi adiada porque o banco já contém dados. Os dados deste navegador foram mantidos.";
  }

  const saveResponse = await fetch("/api/data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revision: current.revision, data })
  });
  const saveResult = await saveResponse.json();
  if (!saveResponse.ok) {
    return `${saveResult.error || "Não foi possível importar os dados antigos."} Os dados locais foram mantidos.`;
  }
  localStorage.removeItem(pendingKey);
  return "Os dados antigos deste navegador foram importados para o banco.";
}

function mostrarErroDeRede(elemento, error) {
  mostrarMensagem(
    elemento,
    error instanceof Error
      ? error.message
      : "Não foi possível conectar ao servidor. Verifique se ele está ativo.",
    "error"
  );
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
    const password = document.querySelector("#login-password").value;
    try {
      const user = await enviarRequisicao("/api/auth/login", {
        matricula,
        password,
        role: loginRole.value
      });
      try {
        const migrationMessage = await importarDadosLocaisPendentes(user);
        if (migrationMessage) {
          sessionStorage.setItem("gavetas-mensagem-migracao", migrationMessage);
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : "erro inesperado";
        sessionStorage.setItem(
          "gavetas-mensagem-migracao",
          `A conta foi acessada, mas a migração local não terminou: ${detail}`
        );
      }
      window.location.href = user.role === "student" ? "aluno.html" : "index.html";
    } catch (error) {
      mostrarErroDeRede(authMessage, error);
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const role = registerRole.value;
    const email = document.querySelector("#register-email").value.trim().toLowerCase();
    const legacyImport = role === "teacher"
      ? prepararImportacaoLocal(email)
      : { data: null, error: null };
    try {
      const result = await enviarRequisicao("/api/auth/register", {
        role,
        email,
        name: document.querySelector("#register-name").value.trim(),
        password: document.querySelector("#register-password").value,
        matricula: role === "student" ? studentMatriculaInput.value.trim() : undefined
      });
      if (legacyImport.data) {
        localStorage.setItem(
          `gavetas-importacao-pendente-${result.matricula}`,
          JSON.stringify(legacyImport.data)
        );
      }
      registrationResult.hidden = false;
      registrationResult.textContent =
        `Cadastro concluído. Matrícula: ${result.matricula}. ` +
        `Código de recuperação: ${result.recoveryCode}. Guarde os dois em local seguro.`;
      if (legacyImport.data) {
        registrationResult.textContent += " Os dados locais serão importados no primeiro acesso.";
      } else if (legacyImport.error) {
        registrationResult.textContent += ` ${legacyImport.error}`;
      }
      registerForm.reset();
      studentRegistrationFields.hidden = true;
      studentMatriculaInput.required = false;
      mostrarMensagem(authMessage, "Cadastro realizado com sucesso.", "success");
    } catch (error) {
      mostrarErroDeRede(authMessage, error);
    }
  });

  forgotForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await enviarRequisicao("/api/auth/reset-password", {
        email: document.querySelector("#forgot-email").value.trim(),
        recoveryCode: document.querySelector("#forgot-recovery-code").value.trim(),
        password: document.querySelector("#forgot-password").value
      });
      forgotForm.reset();
      mostrarMensagem(
        authMessage,
        `Senha atualizada. Novo código de recuperação: ${result.recoveryCode}. Guarde-o em local seguro.`,
        "success"
      );
    } catch (error) {
      mostrarErroDeRede(authMessage, error);
    }
  });
} else {
  window.authReady = (async () => {
    const response = await fetch("/api/auth/session");
    if (response.status === 401) {
      window.location.replace("login.html");
      return null;
    }
    if (!response.ok) {
      throw new Error("Não foi possível verificar a sessão.");
    }
    const user = await response.json();
    const currentPage = window.location.pathname.split(/[\\/]/).pop() || "index.html";
    const isStudentPage = currentPage === "aluno.html";
    if (user.role === "student" && !isStudentPage) {
      window.location.replace("aluno.html");
      return null;
    }
    if (user.role !== "student" && isStudentPage) {
      window.location.replace("index.html");
      return null;
    }
    window.currentProfessor = user;
    const migrationMessage = sessionStorage.getItem("gavetas-mensagem-migracao");
    if (migrationMessage) {
      sessionStorage.removeItem("gavetas-mensagem-migracao");
      const notice = document.createElement("p");
      notice.className = "auth-message";
      notice.setAttribute("role", "status");
      notice.textContent = migrationMessage;
      document.body.prepend(notice);
    }
    return user;
  })().catch((error) => {
    const message = document.createElement("p");
    message.className = "auth-message error";
    message.setAttribute("role", "alert");
    message.textContent = `${error.message} Verifique se o servidor está ativo e recarregue a página.`;
    document.body.prepend(message);
    throw error;
  });

  const logoutButton = document.querySelector("#logout-button");
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      try {
        await enviarRequisicao("/api/auth/logout", {});
        window.location.href = "login.html";
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Não foi possível encerrar a sessão.");
      }
    });
  }
}
