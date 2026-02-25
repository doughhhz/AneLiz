// Seleciona os elementos do menu
const mobileMenu = document.getElementById('mobile-menu');
const navList = document.querySelector('.nav-list');
const glowSlider = document.getElementById('glow-slider');
const imgDepoisWrapper = document.querySelector('.img-depois-wrapper');
const sliderLinha = document.getElementById('slider-linha');
const inputData = document.getElementById('data');
const inputWhatsapp = document.getElementById('whatsapp');

inputWhatsapp.addEventListener('input', function (e) {
    // Remove tudo que não for número
    let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
    // Aplica a formatação (XX) XXXXX-XXXX
    e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
});

const displayMesAno = document.getElementById('mes-ano-display');
const diasGrid = document.getElementById('dias-grid');
const btnPrevMes = document.getElementById('btn-prev-mes');
const btnNextMes = document.getElementById('btn-next-mes');
const inputDataSelecionada = document.getElementById('data-selecionada');
const gradeHorarios = document.getElementById('grade-horarios');
const inputHorarioSelecionado = document.getElementById('horario-selecionado');
const dicaHorario = document.querySelector('.dica-horario');
const elementosReveal = document.querySelectorAll('.reveal');
const observerReveal = new IntersectionObserver((entradas) => {
    entradas.forEach(entrada => {
        if (entrada.isIntersecting) {
            entrada.target.classList.add('ativo');
            
            // A MÁGICA AQUI: Força os carrosséis a recalcularem o tamanho quando surgem na tela!
            setTimeout(() => {
                if (typeof swiper !== 'undefined') swiper.update();
                if (typeof swiperServicos !== 'undefined') swiperServicos.update();
            }, 300); // Aguarda 0.3s (metade da animação) e recalcula
            
            // observerReveal.unobserve(entrada.target); // Opcional: parar de observar depois que aparecer
        }
    });
}, {
    threshold: 0.15 
});

elementosReveal.forEach(elemento => {
    observerReveal.observe(elemento);
});

let dataAtual = new Date();
let mesAtual = dataAtual.getMonth();
let anoAtual = dataAtual.getFullYear();
let diasFechadosGlobais = [];

const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function renderizarCalendario() {
    diasGrid.innerHTML = '';
    displayMesAno.textContent = `${nomesMeses[mesAtual]} ${anoAtual}`;

    const primeiroDiaMes = new Date(anoAtual, mesAtual, 1).getDay();
    const totalDiasMes = new Date(anoAtual, mesAtual + 1, 0).getDate();
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    for (let i = 0; i < primeiroDiaMes; i++) {
        const diaVazio = document.createElement('div');
        diaVazio.classList.add('dia-cal', 'vazio');
        diasGrid.appendChild(diaVazio);
    }

    for (let dia = 1; dia <= totalDiasMes; dia++) {
        const dataDesteDia = new Date(anoAtual, mesAtual, dia);
        const elementoDia = document.createElement('div');
        elementoDia.classList.add('dia-cal');
        elementoDia.textContent = dia;

        // Formata a data para checar no array de dias fechados
        const mesFormatado = String(mesAtual + 1).padStart(2, '0');
        const diaFormatado = String(dia).padStart(2, '0');
        const dataFormatada = `${anoAtual}-${mesFormatado}-${diaFormatado}`;

        if (dataDesteDia < hoje) {
            elementoDia.classList.add('passado');
        } else if (diasFechadosGlobais.includes(dataFormatada)) {
            // Se for um dia bloqueado pela Ane
            elementoDia.classList.add('fechado');
            elementoDia.title = "Agenda fechada neste dia.";
        } else {
            elementoDia.addEventListener('click', () => {
                document.querySelectorAll('.dia-cal').forEach(d => d.classList.remove('selecionado'));
                elementoDia.classList.add('selecionado');
                inputDataSelecionada.value = dataFormatada;
                buscarHorariosDisponiveis(dataFormatada);
            });
        }
        diasGrid.appendChild(elementoDia);
    }
}

// Busca os dias fechados antes de montar o calendário
async function carregarDiasFechados() {
    try {
        const resposta = await fetch('http://127.0.0.1:5000/dias-fechados');
        const dados = await resposta.json();
        diasFechadosGlobais = dados.dias_fechados;
        renderizarCalendario(); // Só renderiza depois de saber os dias fechados
    } catch (e) {
        console.error("Erro ao buscar dias fechados", e);
        renderizarCalendario();
    }
}

// Navegação entre os meses
btnPrevMes.addEventListener('click', () => {
    mesAtual--;
    if (mesAtual < 0) { mesAtual = 11; anoAtual--; }
    renderizarCalendario();
});

btnNextMes.addEventListener('click', () => {
    mesAtual++;
    if (mesAtual > 11) { mesAtual = 0; anoAtual++; }
    renderizarCalendario();
});

// Inicializa o calendário
carregarDiasFechados();

// --- 3. Conexão Real com a API em Python ---
async function buscarHorariosDisponiveis(data) {
    gradeHorarios.innerHTML = '';
    inputHorarioSelecionado.value = '';
    dicaHorario.textContent = "Buscando horários livres no sistema...";

    try {
        const resposta = await fetch(`http://127.0.0.1:5000/horarios/${data}`);
        const dados = await resposta.json();
        const horarios = dados.horarios; // Agora é uma lista de objetos
        
        if (horarios.length === 0) {
            dicaHorario.textContent = "Poxa, não temos mais horários neste dia.";
            return;
        }

        const dataBr = data.split('-').reverse().join('/');
        dicaHorario.textContent = `Agenda para ${dataBr}:`;
        
        horarios.forEach(item => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.classList.add('btn-horario');
            
            const ativarClique = () => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.btn-horario').forEach(b => b.classList.remove('selecionado'));
                    btn.classList.add('selecionado');
                    inputHorarioSelecionado.value = item.horario;
                });
            };

            // AGORA TEMOS 3 STATUS: Confirmado, Concorrido e Livre
            if (item.status === 'confirmado') {
                btn.textContent = `${item.horario} (Reservado)`;
                btn.classList.add('confirmado');
                btn.disabled = true; // Não deixa clicar
                btn.title = "Este horário já foi reservado por outra cliente.";
            } else if (item.status === 'concorrido') {
                btn.textContent = `${item.horario} (Fila)`;
                btn.classList.add('concorrido');
                btn.title = "Outra pessoa já solicitou, mas você pode entrar na fila!";
                ativarClique(); 
            } else {
                btn.textContent = item.horario;
                ativarClique();
            }
            
            gradeHorarios.appendChild(btn);
        });

    } catch (erro) {
        console.error("Erro ao buscar horários:", erro);
        dicaHorario.textContent = "Erro ao conectar com a agenda.";
    }
}

// --- 4. Envio do Formulário para o Banco de Dados ---
const formAgendamento = document.getElementById('form-agendamento');

formAgendamento.addEventListener('submit', async (evento) => {
    evento.preventDefault(); 
    
    const dadosFormulario = {
        nome: document.getElementById('nome').value,
        whatsapp: document.getElementById('whatsapp').value,
        servico: document.getElementById('servico').value,
        data: document.getElementById('data-selecionada').value, 
        horario: document.getElementById('horario-selecionado').value 
    };
    
    if (!dadosFormulario.data || !dadosFormulario.horario) {
        mostrarNotificacao("Por favor, selecione uma data e um horário.", "erro");
        return;
    }

    try {
        const resposta = await fetch('http://127.0.0.1:5000/agendar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosFormulario)
        });

        const resultado = await resposta.json();

        if (resposta.ok) {
            // Nova Notificação Bonita!
            mostrarNotificacao("Solicitação enviada! Redirecionando para o WhatsApp...", "sucesso");
            
            // Lógica de Redirecionamento para o WhatsApp da Anelize
            const numeroAnelize = "5541996272202"; // <-- COLOQUE O NÚMERO DELA AQUI
            
            // Monta a data no formato BR para a mensagem ficar bonita
            const dataBr = dadosFormulario.data.split('-').reverse().join('/');
            const nomeServico = document.getElementById('servico').options[document.getElementById('servico').selectedIndex].text;
            
            const msgZap = `Olá, Anelize! Meu nome é ${dadosFormulario.nome}. Acabei de solicitar um agendamento pelo site para o serviço de *${nomeServico}* no dia *${dataBr}* às *${dadosFormulario.horario}*. Aguardo sua confirmação! ✨`;
            
            // Espera 1.5 segundos para a cliente ler a notificação, limpa o form e abre o WhatsApp
            setTimeout(() => {
                formAgendamento.reset(); 
                renderizarCalendario(); 
                gradeHorarios.innerHTML = '';
                dicaHorario.textContent = "Selecione uma nova data para ver os horários.";
                
                // Abre o WhatsApp com a mensagem pronta
                window.open(`https://wa.me/${numeroAnelize}?text=${encodeURIComponent(msgZap)}`, '_blank');
            }, 1500);

        } else {
            // Se o horário foi pego por outra pessoa no banco de dados
            mostrarNotificacao(resultado.erro, "erro");
            buscarHorariosDisponiveis(dadosFormulario.data); 
        }

    } catch (erro) {
        console.error("Erro ao salvar:", erro);
        mostrarNotificacao("Erro de conexão com o servidor. Tente novamente.", "erro");
    }
});

// Adiciona o evento de clique no botão hambúrguer
mobileMenu.addEventListener('click', () => {
    mobileMenu.classList.toggle('is-active');
    navList.classList.toggle('active');
});

// Fecha o menu automaticamente se a cliente clicar em algum link
document.querySelectorAll('.nav-list li a').forEach(link => {
    link.addEventListener('click', () => {
        mobileMenu.classList.remove('is-active');
        navList.classList.remove('active');
    });
});

// Ouve toda vez que o controle deslizante for movido
glowSlider.addEventListener('input', (evento) => {
    // Pega o valor atual (de 0 a 100)
    const valorSlider = evento.target.value;
    
    // Atualiza a largura da foto de cima e a posição da linha
    imgDepoisWrapper.style.width = `${valorSlider}%`;
    sliderLinha.style.left = `${valorSlider}%`;
});

// Horários fictícios (No futuro, o Python vai enviar isso pro JS)
const horariosDisponiveis = ['09:00', '10:30', '14:00', '15:30', '17:00'];

inputData.addEventListener('change', () => {
    // Limpa os horários anteriores
    gradeHorarios.innerHTML = '';
    inputHorarioSelecionado.value = '';
    
    if(inputData.value) {
        dicaHorario.textContent = "Selecione um horário:";
        
        // Cria um botão para cada horário disponível
        horariosDisponiveis.forEach(hora => {
            const btn = document.createElement('button');
            btn.type = 'button'; // Evita que o botão envie o formulário
            btn.classList.add('btn-horario');
            btn.textContent = hora;
            
            // Lógica de clicar no horário
            btn.addEventListener('click', () => {
                // Remove a classe 'selecionado' de todos os botões
                document.querySelectorAll('.btn-horario').forEach(b => b.classList.remove('selecionado'));
                
                // Adiciona a classe 'selecionado' no botão clicado
                btn.classList.add('selecionado');
                
                // Salva o valor no input oculto para enviar pro banco de dados depois
                inputHorarioSelecionado.value = hora;
            });
            
            gradeHorarios.appendChild(btn);
        });
    }
});

// --- Função de Notificação Customizada ---
function mostrarNotificacao(mensagem, tipo = 'sucesso') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.classList.add('toast', tipo);
    toast.textContent = mensagem;

    container.appendChild(toast);

    // Remove a notificação da tela após 4.5 segundos
    setTimeout(() => {
        toast.style.animation = 'fadeOutRight 0.4s ease forwards';
        setTimeout(() => toast.remove(), 400); // Espera a animação acabar para remover do HTML
    }, 4500);
}

// --- Inicialização do Carrossel de AVALIAÇÕES ---
var swiper = new Swiper(".mySwiper", {
    slidesPerView: 1,
    spaceBetween: 30,
    loop: true,
    observer: true,       // <--- A Mágica para funcionar com animações
    observeParents: true, // <--- A Mágica para funcionar com animações
    autoplay: {
        delay: 3500,
        disableOnInteraction: false,
    },
    pagination: {
        el: ".swiper-pagination",
        clickable: true,
    },
    breakpoints: {
        600: { slidesPerView: 2 }, 
        900: { slidesPerView: 3 }, // Mostra 3 cards mais cedo, em telas de 900px
    },
});

// --- Inicialização do Carrossel de SERVIÇOS ---
var swiperServicos = new Swiper(".servicos-swiper", {
    slidesPerView: 1,
    spaceBetween: 20,
    loop: true,
    observer: true,       // <--- A Mágica para funcionar com animações
    observeParents: true, // <--- A Mágica para funcionar com animações
    autoplay: {
        delay: 3000,
        disableOnInteraction: false,
    },
    pagination: {
        el: ".swiper-pagination",
        clickable: true,
    },
    breakpoints: {
        600: { slidesPerView: 2, spaceBetween: 20 },
        900: { slidesPerView: 3, spaceBetween: 30 },
    },
});