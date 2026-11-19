const STORAGE_KEY = window.currentProfessor && window.currentProfessor.role === "student"
  ? window.currentProfessor.teacherKey
  : window.currentProfessor
    ? `gavetaDeAlunos-${window.currentProfessor.matricula}`
  : "gavetaDeAlunos";
const CLASS_NAMES = ["1ADM1", "1ADM2", "1ADM3", "1MSI", "2MSI", "Senac"];
const SUBJECT_NAMES = [
  "Informática Aplicada",
  "Redes de Computadores",
  "Fundamentos de TI e Sistema Operacional",
  "Desenvolvimento de Sistemas"
];
const activityForm = document.querySelector("#expense-form");
const activityList = document.querySelector("#activity-list");
const studentForm = document.querySelector("#student-form");
const studentList = document.querySelector("#student-list");
const studentClassSelect = document.querySelector("#student-class");
const xlsxImportForm = document.querySelector("#xlsx-import-form");
const xlsxFileInput = document.querySelector("#xlsx-file");
const importClassSelect = document.querySelector("#import-class");
const importSubjectSelect = document.querySelector("#import-subject");
const importStatus = document.querySelector("#xlsx-import-status");
const gradeViewMode = document.querySelector("#grade-view-mode");
const gradeActivitySelect = document.querySelector("#grade-activity");
const gradeClassSelect = document.querySelector("#grade-class");
const gradeActivityControl = document.querySelector("#grade-activity-control");
const gradeClassControl = document.querySelector("#grade-class-control");
const gradeTableHead = document.querySelector("#grade-table-head");
const gradeTableBody = document.querySelector("#grade-table-body");
const gradeMessage = document.querySelector("#grade-message");
const gradeTable = document.querySelector("#grade-table");
const saveGradesButton = document.querySelector("#save-grades");
const calendarForm = document.querySelector("#calendar-form");
const calendarList = document.querySelector("#calendar-list");
const calendarMonthGrid = document.querySelector("#calendar-month-grid");
const calendarCurrentMonth = document.querySelector("#calendar-current-month");
const previousMonthButton = document.querySelector("#previous-month");
const nextMonthButton = document.querySelector("#next-month");
const studentGradeTable = document.querySelector("#student-grade-table");
const studentGradeMessage = document.querySelector("#student-grade-message");
const reportForm = document.querySelector("#report-form");
const reportClassSelect = document.querySelector("#report-class");
const reportSubjectSelect = document.querySelector("#report-subject");
const reportTeacherInput = document.querySelector("#report-teacher");
const reportStatus = document.querySelector("#report-status");
const reportPreview = document.querySelector("#report-preview");
const reportActions = document.querySelector("#report-actions");
const exportXlsxButton = document.querySelector("#export-xlsx");
const exportCsvButton = document.querySelector("#export-csv");
const exportJsonButton = document.querySelector("#export-json");
const printReportButton = document.querySelector("#print-report");
const menuToggle = document.querySelector("#menu-toggle");
const navbar = document.querySelector(".navbar");
let notasDaTela = [];
let ultimaVisualizacao = "activity";
let ultimaAtividade = "";
let ultimaTurma = "";
let relatorioAtual = null;
let mesDoCalendario = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

if (menuToggle && navbar) {
  const fecharMenu = () => {
    navbar.classList.remove("menu-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Abrir menu");
  };

  menuToggle.addEventListener("click", () => {
    const menuAberto = menuToggle.getAttribute("aria-expanded") !== "true";
    navbar.classList.toggle("menu-open", menuAberto);
    menuToggle.setAttribute("aria-expanded", String(menuAberto));
    menuToggle.setAttribute("aria-label", menuAberto ? "Fechar menu" : "Abrir menu");
  });

  navbar.querySelectorAll(".nav-links a").forEach((link) => {
    link.addEventListener("click", fecharMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
      fecharMenu();
      menuToggle.focus();
    }
  });
}

function carregarBanco() {
  const dadosSalvos = localStorage.getItem(STORAGE_KEY);
  if (!dadosSalvos) {
    return { activities: [], students: [], grades: {}, calendarEvents: [] };
  }

  let bancoSalvo;
  try {
    bancoSalvo = JSON.parse(dadosSalvos);
  } catch (error) {
    console.error("Não foi possível carregar os dados locais do calendário.", error);
    return { activities: [], students: [], grades: {}, calendarEvents: [] };
  }
  const alunosAntigos = Array.isArray(bancoSalvo.students) ? bancoSalvo.students : [];
  const alunosMigrados = alunosAntigos.map((aluno, indice) => (
    typeof aluno === "string"
      ? { id: `aluno-antigo-${indice + 1}`, name: aluno, className: "", matricula: "" }
      : { ...aluno, matricula: aluno.matricula || "" }
  ));
  const notasAntigas = bancoSalvo.grades && typeof bancoSalvo.grades === "object"
    ? bancoSalvo.grades
    : {};
  const notasMigradas = {};

  Object.entries(notasAntigas).forEach(([activityId, notas]) => {
    if (Array.isArray(notas)) {
      notasMigradas[activityId] = {};
      notas.forEach((nota, indice) => {
        if (nota !== "" && nota !== null && nota !== undefined) {
          notasMigradas[activityId][alunosMigrados[indice]?.id || `aluno-antigo-${indice + 1}`] = nota;
        }
      });
    } else {
      notasMigradas[activityId] = notas;
    }
  });

  return {
    activities: Array.isArray(bancoSalvo.activities) ? bancoSalvo.activities : [],
    students: alunosMigrados,
    grades: notasMigradas,
    calendarEvents: Array.isArray(bancoSalvo.calendarEvents) ? bancoSalvo.calendarEvents : []
  };
}

const bancoDeAtividades = carregarBanco();
const matriculasExistentes = new Set(
  bancoDeAtividades.students.map((student) => student.matricula).filter(Boolean)
);

function gerarMatriculaAluno() {
  let matricula;
  do {
    matricula = String(Math.floor(10000000 + Math.random() * 90000000));
  } while (matriculasExistentes.has(matricula));
  matriculasExistentes.add(matricula);
  return matricula;
}

bancoDeAtividades.students.forEach((student) => {
  if (!student.matricula) student.matricula = gerarMatriculaAluno();
});
localStorage.setItem(STORAGE_KEY, JSON.stringify(bancoDeAtividades));

function salvarBanco() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bancoDeAtividades));
}

function preencherSelecaoRelatorio(select, valores, textoInicial) {
  select.replaceChildren();
  const initialOption = document.createElement("option");
  initialOption.value = "";
  initialOption.textContent = textoInicial;
  select.appendChild(initialOption);
  valores.forEach((valor) => {
    const option = document.createElement("option");
    option.value = valor;
    option.textContent = valor;
    select.appendChild(option);
  });
}

function escaparHtml(valor) {
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatarNomeArquivo(valor) {
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function baixarArquivo(conteudo, nome, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

function construirRelatorio() {
  const turma = reportClassSelect.value;
  const materia = reportSubjectSelect.value;
  const professor = reportTeacherInput.value.trim();
  const atividades = bancoDeAtividades.activities.filter(
    (atividade) => atividade.className === turma && atividade.subject === materia
  );
  const alunos = bancoDeAtividades.students
    .filter((aluno) => aluno.className === turma)
    .sort((first, second) => (first.name || "").localeCompare(second.name || "", "pt-BR"));

  if (!turma || !materia) throw new Error("Selecione a turma e a matéria.");
  if (atividades.length === 0) throw new Error("Não há atividades dessa matéria para a turma selecionada.");
  if (alunos.length === 0) throw new Error("Não há alunos cadastrados nessa turma.");

  return {
    header: {
      titulo: "Relatório de notas",
      turma,
      materia,
      professor,
      geradoEm: new Date().toLocaleString("pt-BR")
    },
    activities: atividades,
    students: alunos
  };
}

function renderizarRelatorio(relatorio) {
  const cabecalhoProfessor = relatorio.header.professor
    ? `<div><strong>Professor(a):</strong> ${escaparHtml(relatorio.header.professor)}</div>`
    : "";
  const linhas = relatorio.students.map((aluno) => {
    const celulas = relatorio.activities.map((atividade) => {
      const nota = (bancoDeAtividades.grades[atividade.id] || {})[aluno.id] ?? "";
      return `<td>${escaparHtml(nota)}</td>`;
    }).join("");
    return `<tr><td>${escaparHtml(aluno.name)}</td>${celulas}</tr>`;
  }).join("");
  const colunas = relatorio.activities.map((atividade) =>
    `<th>${escaparHtml(atividade.description)}<br><small>Máx. ${escaparHtml(atividade.maxGrade)}</small></th>`
  ).join("");

  reportPreview.innerHTML = `
    <table>
      <thead>
        <tr><th class="report-table-header" colspan="${relatorio.activities.length + 1}">
          ${escaparHtml(relatorio.header.titulo)} — Turma: ${escaparHtml(relatorio.header.turma)} — Matéria: ${escaparHtml(relatorio.header.materia)}
          ${cabecalhoProfessor}
        </th></tr>
        <tr><th>Aluno</th>${colunas}</tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
  `;
  reportPreview.hidden = false;
  reportActions.hidden = false;
}

function linhasDoRelatorio(relatorio) {
  const linhas = [
    ["RELATÓRIO DE NOTAS"],
    ["Turma", relatorio.header.turma],
    ["Matéria", relatorio.header.materia],
    ["Professor(a)", relatorio.header.professor],
    ["Gerado em", relatorio.header.geradoEm],
    [],
    ["Aluno", ...relatorio.activities.map((atividade) => `${atividade.description} (máx. ${atividade.maxGrade})`)]
  ];
  relatorio.students.forEach((aluno) => {
    linhas.push([
      aluno.name,
      ...relatorio.activities.map((atividade) =>
        (bancoDeAtividades.grades[atividade.id] || {})[aluno.id] ?? ""
      )
    ]);
  });
  return linhas;
}

function exportarRelatorioXlsx() {
  if (!relatorioAtual || typeof XLSX === "undefined") {
    reportStatus.textContent = "O leitor de Excel não carregou. Verifique a conexão e tente novamente.";
    reportStatus.className = "report-status error";
    return;
  }
  const worksheet = XLSX.utils.aoa_to_sheet(linhasDoRelatorio(relatorioAtual));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");
  XLSX.writeFile(workbook, `relatorio-${formatarNomeArquivo(relatorioAtual.header.turma)}-${formatarNomeArquivo(relatorioAtual.header.materia)}.xlsx`);
}

function exportarRelatorioCsv() {
  if (!relatorioAtual) return;
  const csv = linhasDoRelatorio(relatorioAtual)
    .map((linha) => linha.map((celula) => `"${String(celula).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  baixarArquivo(
    `\uFEFF${csv}`,
    `relatorio-${formatarNomeArquivo(relatorioAtual.header.turma)}.csv`,
    "text/csv;charset=utf-8"
  );
}

function exportarRelatorioJson() {
  if (!relatorioAtual) return;
  baixarArquivo(
    JSON.stringify({
      ...relatorioAtual.header,
      registros: linhasDoRelatorio(relatorioAtual).slice(6)
    }, null, 2),
    `relatorio-${formatarNomeArquivo(relatorioAtual.header.turma)}.json`,
    "application/json;charset=utf-8"
  );
}

function imprimirRelatorio() {
  if (!relatorioAtual) return;
  const janela = window.open("", "_blank");
  if (!janela) {
    reportStatus.textContent = "Não foi possível abrir a impressão. Verifique o bloqueador de pop-ups.";
    reportStatus.className = "report-status error";
    return;
  }
  janela.document.write(`
    <!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escaparHtml(relatorioAtual.header.titulo)}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #999;padding:7px;text-align:left}th{background:#eef3ff}</style>
    </head><body><h1>${escaparHtml(relatorioAtual.header.titulo)}</h1>${reportPreview.innerHTML}</body></html>
  `);
  janela.document.close();
  janela.focus();
  janela.print();
}

function criarBotaoAcao(texto, classe, acao) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = `record-button ${classe}`;
  botao.textContent = texto;
  botao.addEventListener("click", acao);
  return botao;
}

function criarSelecaoTurma(valorSelecionado, rotulo) {
  const select = document.createElement("select");
  select.required = true;
  select.setAttribute("aria-label", rotulo);

  CLASS_NAMES.forEach((className) => {
    const option = document.createElement("option");
    option.value = className;
    option.textContent = className;
    option.selected = className === valorSelecionado;
    select.appendChild(option);
  });

  return select;
}

function renderizarAtividades() {
  if (!activityList) return;

  activityList.replaceChildren();
  if (bancoDeAtividades.activities.length === 0) {
    activityList.textContent = "Nenhuma atividade adicionada.";
    return;
  }

  bancoDeAtividades.activities.forEach((atividade, indice) => {
    const item = document.createElement("div");
    item.className = "activity-item";
    item.dataset.activityId = atividade.id;
    const info = document.createElement("span");
    info.className = "activity-item-content";
    info.textContent = `${indice + 1}. ${atividade.subject || "Matéria não informada"} - ${atividade.description} - Data: ${formatarData(atividade.date)} - Nota máxima: ${atividade.maxGrade} - Turma: ${atividade.className}`;
    const actions = document.createElement("div");
    actions.className = "record-actions";
    actions.append(
      criarBotaoAcao("Editar", "edit-button", () => editarAtividade(atividade)),
      criarBotaoAcao("Excluir", "delete-button", () => excluirAtividade(atividade))
    );
    item.append(info, actions);
    activityList.appendChild(item);
  });
}

function formatarData(data) {
  if (!data) return "Data não informada";

  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR");
}

function editarAtividade(atividade) {
  const item = Array.from(activityList.children).find(
    (element) => element.dataset.activityId === atividade.id
  );
  if (!item) return;

  const form = document.createElement("form");
  form.className = "inline-edit-form";
  const descriptionInput = document.createElement("input");
  descriptionInput.type = "text";
  descriptionInput.value = atividade.description;
  descriptionInput.required = true;
  descriptionInput.setAttribute("aria-label", "Descrição da atividade");
  descriptionInput.addEventListener("input", () => descriptionInput.setCustomValidity(""));
  const subjectInput = document.createElement("select");
  const emptySubjectOption = document.createElement("option");
  emptySubjectOption.value = "";
  emptySubjectOption.textContent = "Selecione a matéria";
  subjectInput.appendChild(emptySubjectOption);
  if (atividade.subject && !SUBJECT_NAMES.includes(atividade.subject)) {
    const savedSubjectOption = document.createElement("option");
    savedSubjectOption.value = atividade.subject;
    savedSubjectOption.textContent = atividade.subject;
    subjectInput.appendChild(savedSubjectOption);
  }
  SUBJECT_NAMES.forEach((subject) => {
    const option = document.createElement("option");
    option.value = subject;
    option.textContent = subject;
    subjectInput.appendChild(option);
  });
  subjectInput.value = atividade.subject || "";
  subjectInput.required = true;
  subjectInput.setAttribute("aria-label", "Matéria da atividade");
  subjectInput.addEventListener("change", () => subjectInput.setCustomValidity(""));
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = atividade.date || "";
  dateInput.required = true;
  dateInput.setAttribute("aria-label", "Data da atividade");
  const maxGradeInput = document.createElement("input");
  maxGradeInput.type = "number";
  maxGradeInput.min = "0";
  maxGradeInput.step = "any";
  maxGradeInput.value = atividade.maxGrade;
  maxGradeInput.required = true;
  maxGradeInput.setAttribute("aria-label", "Nota máxima");
  const classSelect = criarSelecaoTurma(atividade.className, "Turma da atividade");
  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.className = "record-button edit-button";
  saveButton.textContent = "Salvar";
  form.append(
    descriptionInput,
    subjectInput,
    dateInput,
    maxGradeInput,
    classSelect,
    saveButton,
    criarBotaoAcao("Cancelar", "cancel-button", renderizarAtividades)
  );

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const description = descriptionInput.value.trim();
    if (!description) {
      descriptionInput.setCustomValidity("Informe a descrição da atividade.");
      descriptionInput.reportValidity();
      return;
    }

    const subject = subjectInput.value.trim();
    if (!subject) {
      subjectInput.setCustomValidity("Informe a matéria da atividade.");
      subjectInput.reportValidity();
      return;
    }

    const newClassName = classSelect.value;
    const hasGrades = Object.keys(bancoDeAtividades.grades[atividade.id] || {}).length > 0;
    if (
      newClassName !== atividade.className &&
      hasGrades &&
      !window.confirm("As notas já registradas serão mantidas, mas não aparecerão para os alunos da nova turma. Deseja continuar?")
    ) {
      return;
    }

    atividade.description = description;
    atividade.subject = subject;
    atividade.date = dateInput.value;
    atividade.maxGrade = Number(maxGradeInput.value);
    atividade.className = newClassName;
    salvarBanco();
    renderizarAtividades();
  });

  item.replaceChildren(form);
}

function excluirAtividade(atividade) {
  if (!window.confirm(`Excluir a atividade "${atividade.description}" e todas as notas dela?`)) return;

  bancoDeAtividades.activities = bancoDeAtividades.activities.filter(
    (item) => item.id !== atividade.id
  );
  delete bancoDeAtividades.grades[atividade.id];
  salvarBanco();
  renderizarAtividades();
}

if (activityForm) {
  const descriptionField = document.querySelector("#description");
  const subjectField = document.querySelector("#subject");
  descriptionField.addEventListener("input", () => descriptionField.setCustomValidity(""));
  subjectField.addEventListener("change", () => subjectField.setCustomValidity(""));

  activityForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const descriptionInput = descriptionField;
    const description = descriptionInput.value.trim();
    if (!description) {
      descriptionInput.setCustomValidity("Informe a descrição da atividade.");
      descriptionInput.reportValidity();
      return;
    }

    const subject = subjectField.value.trim();
    if (!subject) {
      subjectField.setCustomValidity("Informe a matéria da atividade.");
      subjectField.reportValidity();
      return;
    }

    const maxGrade = Number(document.querySelector("#amount").value);
    const date = document.querySelector("#activity-date").value;
    const className = document.querySelector("#class").value;

    bancoDeAtividades.activities.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      description,
      subject,
      date,
      maxGrade,
      className
    });
    descriptionInput.setCustomValidity("");
    salvarBanco();
    renderizarAtividades();
    activityForm.reset();
  });

  renderizarAtividades();
}

function renderizarAlunos() {
  if (!studentList) return;

  studentList.replaceChildren();
  CLASS_NAMES.forEach((className) => {
    const section = document.createElement("section");
    section.className = "student-group";
    const heading = document.createElement("h2");
    const studentsInClass = bancoDeAtividades.students
      .filter((student) => student.className === className)
      .sort((first, second) =>
        (first.name || "").localeCompare(second.name || "", "pt-BR", { sensitivity: "base" })
      );
    const studentCount = studentsInClass.length;
    if (studentCount >= 10) section.classList.add("student-group-large");
    heading.textContent = `${className} (${studentCount} ${studentCount === 1 ? "aluno" : "alunos"})`;

    if (studentCount === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.textContent = "Nenhum aluno cadastrado nesta turma.";
      section.append(heading, emptyMessage);
    } else {
      const list = document.createElement("ol");
      studentsInClass.forEach((student) => {
        const item = document.createElement("li");
        const name = document.createElement("span");
        name.className = "student-name";
        name.textContent = `${student.name} — Matrícula: ${student.matricula}`;
        const actions = document.createElement("div");
        actions.className = "record-actions";
        actions.append(
          criarBotaoAcao("Editar", "edit-button", () => editarAluno(student, item)),
          criarBotaoAcao("Excluir", "delete-button", () => excluirAluno(student))
        );
        item.append(name, actions);
        list.appendChild(item);
      });
      section.append(heading, list);
    }

    studentList.appendChild(section);
  });
}

function editarAluno(student, item) {
  const form = document.createElement("form");
  form.className = "inline-edit-form";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = student.name;
  nameInput.required = true;
  nameInput.setAttribute("aria-label", "Nome do aluno");
  nameInput.addEventListener("input", () => nameInput.setCustomValidity(""));
  const classSelect = criarSelecaoTurma(student.className, "Turma do aluno");
  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.className = "record-button edit-button";
  saveButton.textContent = "Salvar";
  form.append(
    nameInput,
    classSelect,
    saveButton,
    criarBotaoAcao("Cancelar", "cancel-button", renderizarAlunos)
  );

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.setCustomValidity("Informe o nome do aluno.");
      nameInput.reportValidity();
      return;
    }

    const hasGrades = Object.values(bancoDeAtividades.grades).some(
      (grades) => grades[student.id] !== undefined && grades[student.id] !== ""
    );
    if (
      classSelect.value !== student.className &&
      hasGrades &&
      !window.confirm("As notas já registradas serão mantidas, mas atividades da turma anterior não mostrarão mais este aluno. Deseja continuar?")
    ) {
      return;
    }

    student.name = name;
    student.className = classSelect.value;
    salvarBanco();
    renderizarAlunos();
  });

  item.replaceChildren(form);
}

function excluirAluno(student) {
  if (!window.confirm(`Excluir o aluno "${student.name}" e todas as notas dele?`)) return;

  bancoDeAtividades.students = bancoDeAtividades.students.filter(
    (item) => item.id !== student.id
  );
  Object.values(bancoDeAtividades.grades).forEach((grades) => {
    delete grades[student.id];
  });
  salvarBanco();
  renderizarAlunos();
}

if (studentForm) {
  const studentNameField = document.querySelector("#student-name");
  studentNameField.addEventListener("input", () => studentNameField.setCustomValidity(""));

  studentForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const studentNameInput = studentNameField;
    const studentName = studentNameInput.value.trim();
    if (!studentName) {
      studentNameInput.setCustomValidity("Informe o nome do aluno.");
      studentNameInput.reportValidity();
      return;
    }

    const className = studentClassSelect.value;
    bancoDeAtividades.students.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: studentName,
      className,
      matricula: gerarMatriculaAluno()
    });
    studentNameInput.setCustomValidity("");
    salvarBanco();
    renderizarAlunos();
    studentForm.reset();
  });

  renderizarAlunos();
}

function normalizarTextoPlanilha(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function encontrarLinhaDeCabecalho(linhas) {
  const cabecalhoDeAtividades = (linha) => {
    const primeiraCelula = normalizarTextoPlanilha(linha[0]);
    return ["data/atividades", "datas/atividades", "atividade", "atividades"].includes(primeiraCelula);
  };
  const limiteDeBusca = Math.min(linhas.length, 10);

  for (let indice = 0; indice < limiteDeBusca; indice += 1) {
    if (cabecalhoDeAtividades(linhas[indice])) return indice;
  }

  for (let indice = 0; indice < limiteDeBusca; indice += 1) {
    const primeiraCelula = normalizarTextoPlanilha(linhas[indice][0]);
    const temCabecalhoDeAluno = ["nome", "nomes", "aluno", "alunos"].includes(primeiraCelula);
    const temAtividade = linhas[indice].slice(1).some((celula) => {
      const cabecalho = normalizarTextoPlanilha(celula);
      return cabecalho && cabecalho !== "total" && !cabecalho.startsWith("total");
    });
    if (temCabecalhoDeAluno && temAtividade) return indice;
  }

  throw new Error("Não encontrei o cabeçalho. Use a primeira coluna para os alunos e a linha de cabeçalho para as atividades.");
}

function dataDoCabecalhoParaISO(valor) {
  if (!(valor instanceof Date) || Number.isNaN(valor.getTime())) return "";
  const ano = valor.getFullYear();
  const mes = String(valor.getMonth() + 1).padStart(2, "0");
  const dia = String(valor.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function analisarPlanilha(linhas, turma) {
  if (!Array.isArray(linhas) || linhas.length === 0) {
    throw new Error("A primeira aba da planilha está vazia.");
  }

  const indiceCabecalho = encontrarLinhaDeCabecalho(linhas);
  const cabecalho = linhas[indiceCabecalho];
  const contagemDeNomes = new Map();
  const atividades = [];

  cabecalho.forEach((valor, indiceColuna) => {
    if (indiceColuna === 0) return;
    const nomeOriginal = valor instanceof Date
      ? valor.toLocaleDateString("pt-BR")
      : String(valor ?? "").trim();
    const nomeNormalizado = normalizarTextoPlanilha(nomeOriginal);
    if (
      !nomeNormalizado ||
      nomeNormalizado === "total" ||
      nomeNormalizado.startsWith("total") ||
      ["data/atividades", "datas/atividades"].includes(nomeNormalizado)
    ) {
      return;
    }

    const contagem = (contagemDeNomes.get(nomeNormalizado) || 0) + 1;
    contagemDeNomes.set(nomeNormalizado, contagem);
    atividades.push({
      coluna: indiceColuna,
      descricao: contagem === 1 ? nomeOriginal : `${nomeOriginal} (${contagem})`,
      data: dataDoCabecalhoParaISO(valor),
      notaMaxima: null
    });
  });

  if (atividades.length === 0) {
    throw new Error("Não encontrei colunas de atividades além de “Total”.");
  }

  const alunos = [];
  for (let indiceLinha = indiceCabecalho + 1; indiceLinha < linhas.length; indiceLinha += 1) {
    const linha = linhas[indiceLinha];
    const nome = String(linha[0] ?? "").trim();
    const nomeNormalizado = normalizarTextoPlanilha(nome);
    if (
      !nome ||
      ["nome", "nomes", "aluno", "alunos", "data/atividades", "datas/atividades", "total"]
        .includes(nomeNormalizado) ||
      nomeNormalizado.startsWith("total") ||
      nomeNormalizado === normalizarTextoPlanilha(turma)
    ) {
      continue;
    }

    const notas = {};
    atividades.forEach((atividade) => {
      const valor = linha[atividade.coluna];
      if (valor === "" || valor === null || valor === undefined) return;

      const textoNota = String(valor).trim();
      if (!textoNota || ["-", "–", "—"].includes(textoNota)) return;
      const nota = typeof valor === "number" ? valor : Number(textoNota.replace(",", "."));
      if (!Number.isFinite(nota) || nota < 0) {
        throw new Error(`Nota inválida na linha ${indiceLinha + 1}, atividade “${atividade.descricao}”. Use notas numéricas iguais ou maiores que zero.`);
      }

      notas[atividade.coluna] = nota;
      atividade.notaMaxima = atividade.notaMaxima === null
        ? nota
        : Math.max(atividade.notaMaxima, nota);
    });

    alunos.push({ nome, notas });
  }

  if (alunos.length === 0) {
    throw new Error("Não encontrei alunos abaixo do cabeçalho.");
  }

  const atividadeSemNotas = atividades.find((atividade) => atividade.notaMaxima === null);
  if (atividadeSemNotas) {
    throw new Error(`A atividade “${atividadeSemNotas.descricao}” não possui notas numéricas para definir a nota máxima.`);
  }

  return { alunos, atividades };
}

function criarId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function atualizarStatusImportacao(mensagem, tipo) {
  importStatus.textContent = mensagem;
  importStatus.className = `import-status ${tipo}`;
}

if (xlsxImportForm) {
  xlsxImportForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const arquivo = xlsxFileInput.files[0];
    if (!arquivo) {
      atualizarStatusImportacao("Selecione um arquivo .xlsx.", "error");
      return;
    }
    if (typeof XLSX === "undefined") {
      atualizarStatusImportacao("O leitor de arquivos Excel não carregou. Verifique a conexão e tente novamente.", "error");
      return;
    }

    try {
      const workbook = XLSX.read(await arquivo.arrayBuffer(), { type: "array", cellDates: true });
      const nomeDaAba = workbook.SheetNames[0];
      if (!nomeDaAba) throw new Error("O arquivo não contém abas.");
      const linhas = XLSX.utils.sheet_to_json(workbook.Sheets[nomeDaAba], {
        header: 1,
        raw: true,
        defval: ""
      });
      const turma = importClassSelect.value;
      const materia = importSubjectSelect.value;
      const importacao = analisarPlanilha(linhas, turma);
      const atividadesPlanejadas = importacao.atividades.map((atividadeImportada) => {
        const existente = bancoDeAtividades.activities.find((atividade) =>
          atividade.className === turma &&
          atividade.subject === materia &&
          normalizarTextoPlanilha(atividade.description) === normalizarTextoPlanilha(atividadeImportada.descricao)
        );
        const atividade = existente
          ? {
            ...existente,
            maxGrade: atividadeImportada.notaMaxima,
            date: atividadeImportada.data || existente.date || ""
          }
          : {
            id: criarId(),
            description: atividadeImportada.descricao,
            subject: materia,
            className: turma,
            maxGrade: atividadeImportada.notaMaxima,
            date: atividadeImportada.data
          };
        return { atividadeImportada, atividade, existente };
      });
      const existentesParaAtualizar = atividadesPlanejadas.filter((item) => item.existente).length;
      const confirmarImportacao = window.confirm(
        `Importar ${importacao.alunos.length} alunos e ${atividadesPlanejadas.length} atividades para ${turma} — ${materia}? ` +
        `A nota máxima será a maior nota encontrada em cada coluna. Notas vazias substituirão notas anteriores. ` +
        `${existentesParaAtualizar} atividades existentes serão atualizadas.`
      );
      if (!confirmarImportacao) {
        atualizarStatusImportacao("Importação cancelada.", "");
        return;
      }

      const alunos = [...bancoDeAtividades.students];
      const alunosImportados = importacao.alunos.map((alunoImportado) => {
        let aluno = alunos.find((existente) =>
          existente.className === turma &&
          normalizarTextoPlanilha(existente.name) === normalizarTextoPlanilha(alunoImportado.nome)
        );
        if (!aluno) {
          aluno = { id: criarId(), name: alunoImportado.nome, className: turma };
          alunos.push(aluno);
        }
        return { aluno, alunoImportado };
      });

      const notas = {};
      Object.keys(bancoDeAtividades.grades).forEach((atividadeId) => {
        notas[atividadeId] = { ...bancoDeAtividades.grades[atividadeId] };
      });
      const atividades = [...bancoDeAtividades.activities];
      atividadesPlanejadas.forEach(({ atividadeImportada, atividade, existente }) => {
        const indiceExistente = atividades.findIndex((item) => item.id === atividade.id);
        if (indiceExistente === -1) {
          atividades.push(atividade);
        } else {
          atividades[indiceExistente] = atividade;
        }

        const notasDaAtividade = { ...(notas[atividade.id] || {}) };
        alunosImportados.forEach(({ aluno, alunoImportado }) => {
          const nota = alunoImportado.notas[atividadeImportada.coluna];
          if (nota === undefined) {
            delete notasDaAtividade[aluno.id];
          } else {
            notasDaAtividade[aluno.id] = String(nota);
          }
        });
        notas[atividade.id] = notasDaAtividade;
      });

      const bancoImportado = { activities: atividades, students: alunos, grades: notas };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bancoImportado));
      bancoDeAtividades.activities = atividades;
      bancoDeAtividades.students = alunos;
      bancoDeAtividades.grades = notas;
      renderizarAlunos();
      xlsxImportForm.reset();
      atualizarStatusImportacao(
        `Importação concluída: ${alunosImportados.length} alunos processados e ${atividadesPlanejadas.length} atividades importadas. A planilha foi lida neste navegador.`,
        "success"
      );
    } catch (error) {
      console.error("Falha ao importar a planilha Excel:", error);
      atualizarStatusImportacao(
        error instanceof Error ? `Não foi possível importar: ${error.message}` : "Não foi possível importar a planilha.",
        "error"
      );
    }
  });
}

function renderizarAtividadesParaNotas() {
  gradeActivitySelect.replaceChildren();
  const initialOption = document.createElement("option");
  initialOption.value = "";
  initialOption.textContent = "Selecione uma atividade";
  gradeActivitySelect.appendChild(initialOption);

  bancoDeAtividades.activities.forEach((atividade) => {
    const option = document.createElement("option");
    option.value = atividade.id;
    option.textContent = `${atividade.subject || "Matéria não informada"} — ${atividade.description} (${atividade.className}) — ${formatarData(atividade.date)}`;
    gradeActivitySelect.appendChild(option);
  });

  gradeClassSelect.replaceChildren();
  const initialClassOption = document.createElement("option");
  initialClassOption.value = "";
  initialClassOption.textContent = "Selecione uma turma";
  gradeClassSelect.appendChild(initialClassOption);
  CLASS_NAMES.forEach((className) => {
    const option = document.createElement("option");
    option.value = className;
    option.textContent = className;
    gradeClassSelect.appendChild(option);
  });

  ultimaVisualizacao = gradeViewMode.value;
  ultimaAtividade = gradeActivitySelect.value;
  ultimaTurma = gradeClassSelect.value;
  atualizarControlesNotas();
  mostrarTabelaDeNotas();
}

function atualizarControlesNotas() {
  const mostrarTurma = gradeViewMode.value === "class";
  gradeActivityControl.hidden = mostrarTurma;
  gradeClassControl.hidden = !mostrarTurma;
}

function confirmarDescarteDeNotas(control, valorAnterior) {
  if (notasDaTela.some((nota) => nota.gradeInput.value !== nota.savedGrade)) {
    if (!window.confirm("Há notas não salvas. Deseja descartá-las?")) {
      control.value = valorAnterior;
      return false;
    }
  }
  return true;
}

function mostrarTabelaDeNotas() {
  gradeTableHead.replaceChildren();
  gradeTableBody.replaceChildren();
  notasDaTela = [];
  const visualizarTurma = gradeViewMode.value === "class";
  const activity = bancoDeAtividades.activities.find(
    (item) => item.id === gradeActivitySelect.value
  );
  const className = visualizarTurma ? gradeClassSelect.value : activity && activity.className;

  if (!className) {
    gradeMessage.textContent = visualizarTurma
      ? "Selecione uma turma para visualizar as atividades e notas."
      : bancoDeAtividades.activities.length
        ? "Selecione uma atividade para lançar as notas."
        : "Cadastre uma atividade primeiro na página Atividade.";
    gradeTable.hidden = true;
    saveGradesButton.hidden = true;
    return;
  }

  const activities = visualizarTurma
    ? bancoDeAtividades.activities.filter((item) => item.className === className)
    : activity ? [activity] : [];
  if (activities.length === 0) {
    gradeMessage.textContent = `Não há atividades cadastradas para a turma ${className}.`;
    gradeTable.hidden = true;
    saveGradesButton.hidden = true;
    return;
  }

  const studentsInClass = bancoDeAtividades.students
    .filter((student) => student.className === className)
    .sort((first, second) =>
      (first.name || "").localeCompare(second.name || "", "pt-BR", { sensitivity: "base" })
    );
  if (studentsInClass.length === 0) {
    gradeMessage.textContent = `Não há alunos cadastrados na turma ${className}. Cadastre-os na página Alunos.`;
    gradeTable.hidden = true;
    saveGradesButton.hidden = true;
    return;
  }

  gradeMessage.textContent = visualizarTurma
    ? `Turma: ${className} — ${activities.length} ${activities.length === 1 ? "atividade" : "atividades"}`
    : `Matéria: ${activity.subject || "Não informada"} — Turma: ${className} — Data: ${formatarData(activity.date)} — Nota máxima: ${activity.maxGrade}`;
  gradeTable.hidden = false;
  saveGradesButton.hidden = false;
  gradeTable.className = visualizarTurma ? "grade-matrix" : "";

  const headerRow = document.createElement("tr");
  const studentHeader = document.createElement("th");
  studentHeader.scope = "col";
  studentHeader.textContent = "Aluno";
  headerRow.appendChild(studentHeader);
  activities.forEach((item) => {
    const activityHeader = document.createElement("th");
    const title = document.createElement("div");
    const details = document.createElement("small");
    activityHeader.scope = "col";
    title.className = "grade-activity-title";
    title.textContent = item.subject
      ? `${item.subject} — ${item.description}`
      : item.description;
    details.textContent = `${formatarData(item.date)} · Máx. ${item.maxGrade}`;
    activityHeader.append(title, details);
    headerRow.appendChild(activityHeader);
  });
  gradeTableHead.appendChild(headerRow);

  studentsInClass.forEach((student) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    nameCell.textContent = student.name;
    row.appendChild(nameCell);

    activities.forEach((currentActivity) => {
      const gradeCell = document.createElement("td");
      gradeCell.className = "grade-cell";
      const gradeInput = document.createElement("input");
      const gradeError = document.createElement("small");
      const savedGrade = String(
        (bancoDeAtividades.grades[currentActivity.id] || {})[student.id] ?? ""
      );
      gradeError.className = "grade-error";
      gradeError.id = `grade-error-${currentActivity.id}-${student.id}`;
      const gradeRow = {
        activityId: currentActivity.id,
        studentId: student.id,
        gradeInput,
        gradeError,
        savedGrade
      };

      gradeInput.type = "number";
      gradeInput.min = "0";
      gradeInput.max = String(currentActivity.maxGrade);
      gradeInput.step = "any";
      gradeInput.value = savedGrade;
      gradeInput.setAttribute("aria-label", `Nota de ${student.name} em ${currentActivity.description}`);
      gradeInput.setAttribute("aria-describedby", gradeError.id);
      validarNota(gradeInput, gradeError, currentActivity.maxGrade);
      gradeInput.addEventListener("input", () => {
        validarNota(gradeInput, gradeError, currentActivity.maxGrade);
        atualizarBotaoSalvarNotas();
      });

      gradeCell.append(gradeInput, gradeError);
      row.appendChild(gradeCell);
      notasDaTela.push(gradeRow);
    });

    gradeTableBody.appendChild(row);
  });

  atualizarBotaoSalvarNotas();
}

function atualizarBotaoSalvarNotas() {
  const temAlteracoes = notasDaTela.some(
    (nota) => nota.gradeInput.value !== nota.savedGrade
  );
  const temNotaInvalida = notasDaTela.some((nota) => !nota.gradeInput.checkValidity());
  saveGradesButton.disabled = !temAlteracoes || temNotaInvalida;
  saveGradesButton.textContent = temNotaInvalida
    ? "Corrija as notas"
    : temAlteracoes
      ? "Salvar notas"
      : "Notas salvas";
}

function validarNota(input, errorMessage, notaMaxima) {
  let mensagem = "";
  if (input.value !== "" && Number(input.value) < 0) {
    mensagem = "A nota não pode ser menor que zero.";
  } else if (input.value !== "" && Number(input.value) > notaMaxima) {
    mensagem = `A nota não pode ultrapassar ${notaMaxima}.`;
  }

  input.setCustomValidity(mensagem);
  input.setAttribute("aria-invalid", mensagem ? "true" : "false");
  errorMessage.textContent = mensagem;
}

if (saveGradesButton) {
  saveGradesButton.addEventListener("click", () => {
    for (const nota of notasDaTela) {
      if (!nota.gradeInput.checkValidity()) {
        nota.gradeInput.reportValidity();
        return;
      }
    }

    const gradesPorAtividade = new Map();
    notasDaTela.forEach((nota) => {
      if (!gradesPorAtividade.has(nota.activityId)) {
        gradesPorAtividade.set(
          nota.activityId,
          { ...(bancoDeAtividades.grades[nota.activityId] || {}) }
        );
      }
      const grades = gradesPorAtividade.get(nota.activityId);
      if (nota.gradeInput.value === "") {
        delete grades[nota.studentId];
      } else {
        grades[nota.studentId] = nota.gradeInput.value;
      }
      nota.savedGrade = nota.gradeInput.value;
    });
    gradesPorAtividade.forEach((grades, activityId) => {
      bancoDeAtividades.grades[activityId] = grades;
    });
    salvarBanco();
    atualizarBotaoSalvarNotas();
  });
}

if (gradeActivitySelect) {
  gradeViewMode.addEventListener("change", () => {
    if (!confirmarDescarteDeNotas(gradeViewMode, ultimaVisualizacao)) return;
    ultimaVisualizacao = gradeViewMode.value;
    atualizarControlesNotas();
    mostrarTabelaDeNotas();
  });
  gradeActivitySelect.addEventListener("change", () => {
    if (!confirmarDescarteDeNotas(gradeActivitySelect, ultimaAtividade)) return;
    ultimaAtividade = gradeActivitySelect.value;
    mostrarTabelaDeNotas();
  });
  gradeClassSelect.addEventListener("change", () => {
    if (!confirmarDescarteDeNotas(gradeClassSelect, ultimaTurma)) return;
    ultimaTurma = gradeClassSelect.value;
    mostrarTabelaDeNotas();
  });
  renderizarAtividadesParaNotas();
}

if (reportForm) {
  preencherSelecaoRelatorio(reportClassSelect, CLASS_NAMES, "Selecione a turma");
  preencherSelecaoRelatorio(reportSubjectSelect, SUBJECT_NAMES, "Selecione a matéria");

  reportForm.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      relatorioAtual = construirRelatorio();
      renderizarRelatorio(relatorioAtual);
      reportStatus.textContent = "Relatório montado. Escolha como deseja guardá-lo.";
      reportStatus.className = "report-status";
    } catch (error) {
      relatorioAtual = null;
      reportPreview.hidden = true;
      reportActions.hidden = true;
      reportStatus.textContent = error instanceof Error
        ? error.message
        : "Não foi possível montar o relatório.";
      reportStatus.className = "report-status error";
    }
  });

  exportXlsxButton.addEventListener("click", exportarRelatorioXlsx);
  exportCsvButton.addEventListener("click", exportarRelatorioCsv);
  exportJsonButton.addEventListener("click", exportarRelatorioJson);
  printReportButton.addEventListener("click", imprimirRelatorio);
}

function renderizarCalendario() {
  if (!calendarList) return;
  calendarList.replaceChildren();
  const eventos = [...bancoDeAtividades.calendarEvents].sort((first, second) =>
    first.date.localeCompare(second.date)
  );
  const atividades = [...bancoDeAtividades.activities]
    .filter((atividade) => atividade.date)
    .sort((first, second) => first.date.localeCompare(second.date));
  const mesAtual = `${mesDoCalendario.getFullYear()}-${String(mesDoCalendario.getMonth() + 1).padStart(2, "0")}`;
  const eventosDoMes = eventos.filter((evento) => evento.date.startsWith(mesAtual));
  const atividadesDoMes = atividades.filter((atividade) => atividade.date.startsWith(mesAtual));
  if (eventosDoMes.length === 0 && atividadesDoMes.length === 0) {
    calendarList.textContent = "Nenhum evento ou atividade cadastrado.";
  } else {
    eventosDoMes.forEach((evento) => {
      const item = document.createElement("div");
      item.className = "calendar-event";
      const details = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = evento.title;
      const date = document.createElement("span");
      date.textContent = `${formatarData(evento.date)} — ${evento.type}`;
      details.append(title, date);
      item.append(details, criarBotaoAcao("Excluir", "delete-button", () => {
        bancoDeAtividades.calendarEvents = bancoDeAtividades.calendarEvents.filter(
          (currentEvent) => currentEvent.id !== evento.id
        );
        salvarBanco();
        renderizarCalendario();
      }));
      calendarList.appendChild(item);
    });
    atividadesDoMes.forEach((atividade) => {
      const item = document.createElement("div");
      item.className = "calendar-event";
      const details = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = atividade.description;
      const date = document.createElement("span");
      date.textContent = `${formatarData(atividade.date)} — Atividade de ${atividade.subject}`;
      details.append(title, date);
      item.append(details, criarBotaoAcao("Abrir atividade", "edit-button", () => {
        window.location.href = "atividade.html";
      }));
      calendarList.appendChild(item);
    });
  }
  renderizarMesCalendario();
}

function dataISO(ano, mes, dia) {
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function renderizarMesCalendario() {
  if (!calendarMonthGrid) return;
  calendarMonthGrid.replaceChildren();
  const ano = mesDoCalendario.getFullYear();
  const mes = mesDoCalendario.getMonth();
  calendarCurrentMonth.textContent = mesDoCalendario.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const quantidadeDeDias = new Date(ano, mes + 1, 0).getDate();
  const itens = [
    ...bancoDeAtividades.calendarEvents.map((evento) => ({
      date: evento.date,
      label: evento.title,
      type: evento.type,
      kind: "event"
    })),
    ...bancoDeAtividades.activities.map((atividade) => ({
      date: atividade.date,
      label: atividade.description,
      type: atividade.subject || "Atividade",
      kind: "activity"
    }))
  ];

  for (let indice = 0; indice < primeiroDia; indice += 1) {
    const vazio = document.createElement("div");
    vazio.className = "calendar-day calendar-day-empty";
    calendarMonthGrid.appendChild(vazio);
  }

  for (let dia = 1; dia <= quantidadeDeDias; dia += 1) {
    const data = dataISO(ano, mes, dia);
    const celula = document.createElement("div");
    celula.className = "calendar-day";
    const numero = document.createElement("span");
    numero.className = "calendar-day-number";
    numero.textContent = String(dia);
    celula.appendChild(numero);
    itens.filter((item) => item.date === data).forEach((item) => {
      const evento = document.createElement(item.kind === "activity" ? "button" : "div");
      evento.className = "calendar-day-event";
      evento.title = `${item.type}: ${item.label}`;
      evento.textContent = item.label;
      if (item.kind === "activity") {
        evento.type = "button";
        evento.setAttribute("aria-label", `Abrir atividade ${item.label}`);
        evento.addEventListener("click", () => {
          window.location.href = "atividade.html";
        });
      }
      celula.appendChild(evento);
    });
    calendarMonthGrid.appendChild(celula);
  }

  const quantidadePreenchida = primeiroDia + quantidadeDeDias;
  const quantidadeParaCompletar = (7 - (quantidadePreenchida % 7)) % 7;
  for (let indice = 0; indice < quantidadeParaCompletar; indice += 1) {
    const vazio = document.createElement("div");
    vazio.className = "calendar-day calendar-day-empty";
    calendarMonthGrid.appendChild(vazio);
  }
}

if (calendarForm) {
  calendarForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const titleInput = document.querySelector("#calendar-event");
    const dateInput = document.querySelector("#calendar-date");
    const typeInput = document.querySelector("#calendar-type");
    bancoDeAtividades.calendarEvents.push({
      id: criarId(),
      title: titleInput.value.trim(),
      date: dateInput.value,
      type: typeInput.value
    });
    salvarBanco();
    calendarForm.reset();
    renderizarCalendario();
  });
  renderizarCalendario();
  previousMonthButton.addEventListener("click", () => {
    mesDoCalendario = new Date(mesDoCalendario.getFullYear(), mesDoCalendario.getMonth() - 1, 1);
    renderizarCalendario();
  });
  nextMonthButton.addEventListener("click", () => {
    mesDoCalendario = new Date(mesDoCalendario.getFullYear(), mesDoCalendario.getMonth() + 1, 1);
    renderizarCalendario();
  });
}

function renderizarNotasDoAluno() {
  if (!studentGradeTable || !window.currentProfessor) return;
  const student = bancoDeAtividades.students.find(
    (item) => item.id === window.currentProfessor.studentId
  );
  if (!student) {
    studentGradeMessage.textContent = "Seu cadastro de aluno não foi encontrado.";
    return;
  }

  const activities = bancoDeAtividades.activities
    .filter((activity) => activity.className === student.className)
    .sort((first, second) => first.date.localeCompare(second.date));
  studentGradeMessage.textContent = `${student.name} — Turma: ${student.className}`;
  if (activities.length === 0) {
    studentGradeMessage.textContent += " — Nenhuma atividade cadastrada.";
    return;
  }

  const header = studentGradeTable.querySelector("thead");
  const body = studentGradeTable.querySelector("tbody");
  const headerRow = document.createElement("tr");
  ["Matéria", "Atividade", "Data", "Nota máxima", "Minha nota"].forEach((label) => {
    const cell = document.createElement("th");
    cell.textContent = label;
    headerRow.appendChild(cell);
  });
  header.appendChild(headerRow);

  activities.forEach((activity) => {
    const row = document.createElement("tr");
    const grade = (bancoDeAtividades.grades[activity.id] || {})[student.id] ?? "Ainda não lançada";
    [activity.subject, activity.description, formatarData(activity.date), activity.maxGrade, grade]
      .forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
    body.appendChild(row);
  });
  studentGradeTable.hidden = false;
}

if (studentGradeTable) renderizarNotasDoAluno();
