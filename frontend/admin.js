const urlBase = 'https://doughhzz.pythonanywhere.com/';

// Função para buscar os dados no Python
async function carregarAgendamentos() {
    const container = document.getElementById('lista-agendamentos');
    container.innerHTML = '<p>A carregar agenda...</p>';

    try {
        const resposta = await fetch(`${urlBase}/admin/agendamentos`);
        const agendamentos = await resposta.json();
        
        container.innerHTML = ''; // Limpa a mensagem de carregamento

        if(agendamentos.length === 0) {
            container.innerHTML = '<p>Nenhum agendamento registado ainda.</p>';
            return;
        }

        // Cria um cartão para cada agendamento
        agendamentos.forEach(ag => {
            // Formata a data de YYYY-MM-DD para DD/MM/YYYY
            const dataBr = ag.data.split('-').reverse().join('/');
            
            const card = document.createElement('div');
            card.className = `card-agendamento ${ag.status}`;
            
            card.innerHTML = `
                <div class="status-badge">${ag.status}</div>
                <h3 class="cliente-nome">${ag.nome}</h3>
                <p class="info-linha"><strong>Serviço:</strong> ${ag.servico}</p>
                <p class="info-linha"><strong>Data:</strong> ${dataBr}</p>
                <p class="info-linha"><strong>Horário:</strong> ${ag.horario}</p>
                <p class="info-linha"><strong>Telemóvel:</strong> ${ag.whatsapp}</p>
                
                <a href="https://wa.me/55${ag.whatsapp.replace(/\D/g, '')}" target="_blank" class="btn-whatsapp">
                    Falar no WhatsApp
                </a>
            `;

            // Só mostra os botões de Confirmar/Recusar se estiver "pendente"
            if (ag.status === 'pendente') {
                const divBotoes = document.createElement('div');
                divBotoes.className = 'botoes-acao';
                
                divBotoes.innerHTML = `
                    <button class="btn-confirmar" onclick="alterarStatus(${ag.id}, 'confirmar')">Confirmar</button>
                    <button class="btn-recusar" onclick="alterarStatus(${ag.id}, 'recusar')">Recusar</button>
                `;
                card.appendChild(divBotoes);
            }

            container.appendChild(card);
        });

    } catch (erro) {
        console.error(erro);
        container.innerHTML = '<p>Erro ao ligar ao servidor. Verifique se o Python está a correr.</p>';
    }
}

// Função para Confirmar ou Recusar
async function alterarStatus(id, acao) {
    // Confirmação animada e bonita
    const confirmacao = await Swal.fire({
        title: 'Tem a certeza?',
        text: `Deseja realmente ${acao} este horário?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: acao === 'confirmar' ? '#27ae60' : '#e74c3c',
        cancelButtonColor: '#95a5a6',
        confirmButtonText: `Sim, ${acao}!`,
        cancelButtonText: 'Cancelar',
        shape: 'border-radius: 12px'
    });

    if (!confirmacao.isConfirmed) return; // Se a pessoa cancelar, para aqui

    try {
        const resposta = await fetch(`${urlBase}/${acao}/${id}`, { method: 'POST' });
        const resultado = await resposta.json();

        if (resposta.ok) {
            // Notificação de sucesso animada
            Swal.fire({
                title: 'Feito!',
                text: resultado.mensagem || "Status atualizado com sucesso!",
                icon: 'success',
                confirmButtonColor: '#d4a373'
            });
            carregarAgendamentos(); 
            carregarFaturamento(); 
        } else {
            Swal.fire('Ops!', resultado.erro, 'error');
        }
    } catch (erro) {
        Swal.fire('Erro de Conexão', 'Verifique se o servidor está rodando.', 'error');
    }
}

// --- Função para bloquear o dia ---
async function bloquearDiaAdmin() {
    const data = document.getElementById('data-bloqueio').value;
    if (!data) {
        Swal.fire('Atenção', 'Por favor, selecione uma data no calendário primeiro.', 'warning');
        return;
    }

    try {
        const resposta = await fetch(`${urlBase}/admin/dias-fechados`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: data })
        });
        
        const resultado = await resposta.json();
        if (resposta.ok) {
            Swal.fire({
                title: 'Dia Bloqueado!',
                text: resultado.mensagem,
                icon: 'success',
                confirmButtonColor: '#d4a373'
            });
            document.getElementById('data-bloqueio').value = ''; 
        }
    } catch (erro) {
        Swal.fire('Erro', 'Não foi possível bloquear o dia.', 'error');
    }
}

// --- Função para Carregar os Números Financeiros ---
async function carregarFaturamento() {
    try {
        const resposta = await fetch(`${urlBase}/admin/faturamento`);
        const dados = await resposta.json();
        
        // Função mágica do JS para formatar em Reais (R$)
        const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        document.getElementById('fat-mes').textContent = formatarMoeda(dados.faturamento_mes);
        document.getElementById('fat-total').textContent = formatarMoeda(dados.faturamento_total);
        document.getElementById('total-clientes').textContent = dados.total_clientes;
    } catch (erro) {
        console.error("Erro ao carregar faturamento:", erro);
    }
}

// Carrega os dados assim que o ecrã abre
window.onload = () => {
    carregarAgendamentos();
    carregarFaturamento();
};