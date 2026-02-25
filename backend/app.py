from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import datetime

app = Flask(__name__)
CORS(app)
DB_NOME = 'agenda_aneliz.db'

def iniciar_banco():
    conn = sqlite3.connect(DB_NOME)
    cursor = conn.cursor()
    # Tabela de Agendamentos (já existia)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS agendamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            whatsapp TEXT NOT NULL,
            servico TEXT NOT NULL,
            data TEXT NOT NULL,
            horario TEXT NOT NULL,
            status TEXT DEFAULT 'pendente'
        )
    ''')
    # NOVA Tabela de Dias Fechados
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS dias_fechados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT UNIQUE NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

iniciar_banco()

# --- Rota para Buscar Horários Disponíveis (ATUALIZADA) ---
@app.route('/horarios/<data>', methods=['GET'])
def get_horarios_disponiveis(data):
    horarios_trabalho = ['09:00', '10:30', '14:00', '15:30', '17:00', '18:30']
    
    conn = sqlite3.connect(DB_NOME)
    cursor = conn.cursor()
    
    cursor.execute('SELECT horario, status FROM agendamentos WHERE data = ?', (data,))
    agendados = cursor.fetchall()
    conn.close()
    
    status_por_horario = {}
    for h, status in agendados:
        if h not in status_por_horario:
            status_por_horario[h] = []
        status_por_horario[h].append(status)
    
    lista_final = []
    
    for h in horarios_trabalho:
        if h in status_por_horario:
            # AGORA: Se está confirmado, vai para a lista como "confirmado"
            if 'confirmado' in status_por_horario[h]:
                lista_final.append({"horario": h, "status": "confirmado"})
            else:
                lista_final.append({"horario": h, "status": "concorrido"})
        else:
            lista_final.append({"horario": h, "status": "livre"})
            
    return jsonify({"horarios": lista_final})

# --- NOVAS ROTAS: Dias Fechados ---
@app.route('/dias-fechados', methods=['GET'])
def listar_dias_fechados():
    conn = sqlite3.connect(DB_NOME)
    cursor = conn.cursor()
    cursor.execute('SELECT data FROM dias_fechados')
    dias = [linha[0] for linha in cursor.fetchall()]
    conn.close()
    return jsonify({"dias_fechados": dias})

@app.route('/admin/dias-fechados', methods=['POST'])
def bloquear_dia():
    dados = request.get_json()
    data = dados.get('data')
    
    conn = sqlite3.connect(DB_NOME)
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO dias_fechados (data) VALUES (?)', (data,))
        conn.commit()
    except sqlite3.IntegrityError:
        pass # Ignora se o dia já estiver bloqueado
    finally:
        conn.close()
        
    return jsonify({"sucesso": True, "mensagem": "Dia bloqueado com sucesso!"})

# --- Rota para Salvar o Agendamento (Agora permite múltiplos pendentes) ---
@app.route('/agendar', methods=['POST'])
def salvar_agendamento():
    dados = request.get_json()
    nome = dados.get('nome')
    whatsapp = dados.get('whatsapp')
    servico = dados.get('servico')
    data = dados.get('data')
    horario = dados.get('horario')
    
    conn = sqlite3.connect(DB_NOME)
    cursor = conn.cursor()
    
    # Bloqueia APENAS se o horário já estiver 'confirmado' pela Ane
    cursor.execute("SELECT id FROM agendamentos WHERE data = ? AND horario = ? AND status = 'confirmado'", (data, horario))
    if cursor.fetchone():
        conn.close()
        return jsonify({"erro": "Poxa, a Ane acabou de confirmar este horário para outra cliente."}), 409
        
    # Salva como pendente (entra na fila de disputa)
    cursor.execute('''
        INSERT INTO agendamentos (nome, whatsapp, servico, data, horario, status) 
        VALUES (?, ?, ?, ?, ?, 'pendente')
    ''', (nome, whatsapp, servico, data, horario))
    
    conn.commit()
    conn.close()
    
    return jsonify({"sucesso": True}), 201

# --- NOVA ROTA: Para a Ane Confirmar o Horário ---
@app.route('/confirmar/<int:id_agendamento>', methods=['POST'])
def confirmar_agendamento(id_agendamento):
    conn = sqlite3.connect(DB_NOME)
    cursor = conn.cursor()

    # Pega os detalhes (data e hora) do agendamento que a Ane escolheu
    cursor.execute('SELECT data, horario FROM agendamentos WHERE id = ?', (id_agendamento,))
    agendamento = cursor.fetchone()

    if not agendamento:
        conn.close()
        return jsonify({"erro": "Agendamento não encontrado."}), 404

    data, horario = agendamento

    # Mágica: Primeiro, recusa/cancela TODOS os pedidos para essa mesma data e hora
    cursor.execute("UPDATE agendamentos SET status = 'recusado' WHERE data = ? AND horario = ?", (data, horario))

    # Depois, atualiza APENAS o ID que a Ane escolheu para 'confirmado'
    cursor.execute("UPDATE agendamentos SET status = 'confirmado' WHERE id = ?", (id_agendamento,))

    conn.commit()
    conn.close()
    
    return jsonify({"sucesso": True, "mensagem": "Horário confirmado com sucesso! Os outros pedidos foram removidos da disputa."})

# --- ROTA ADMIN: Listar todos os agendamentos ---
@app.route('/admin/agendamentos', methods=['GET'])
def listar_agendamentos():
    conn = sqlite3.connect(DB_NOME)
    cursor = conn.cursor()
    # Puxa tudo ordenado pela data e horário mais próximos
    cursor.execute('SELECT id, nome, whatsapp, servico, data, horario, status FROM agendamentos ORDER BY data, horario')
    linhas = cursor.fetchall()
    conn.close()
    
    agendamentos = []
    for linha in linhas:
        agendamentos.append({
            "id": linha[0],
            "nome": linha[1],
            "whatsapp": linha[2],
            "servico": linha[3],
            "data": linha[4],
            "horario": linha[5],
            "status": linha[6]
        })
        
    return jsonify(agendamentos)

# --- ROTA ADMIN: Recusar/Cancelar um horário ---
@app.route('/recusar/<int:id_agendamento>', methods=['POST'])
def recusar_agendamento(id_agendamento):
    conn = sqlite3.connect(DB_NOME)
    cursor = conn.cursor()
    
    cursor.execute("UPDATE agendamentos SET status = 'recusado' WHERE id = ?", (id_agendamento,))
    
    conn.commit()
    conn.close()
    
    return jsonify({"sucesso": True, "mensagem": "Agendamento recusado e horário libertado."})

# --- ROTA ADMIN: Calcular Faturamento ---
@app.route('/admin/faturamento', methods=['GET'])
def obter_faturamento():
    conn = sqlite3.connect(DB_NOME)
    cursor = conn.cursor()
    
    # Tabela de preços base (você pode ajustar esses valores depois)
    precos_base = {
        'corte': 65.0,
        'mechas': 280.0,
        'selagem': 180.0,
        'progressiva': 180.0,
        'escova': 40.0,
        'tintura': 90.0
    }
    
    # Busca apenas os horários que a Ane já confirmou
    cursor.execute("SELECT servico, data FROM agendamentos WHERE status = 'confirmado'")
    confirmados = cursor.fetchall()
    conn.close()
    
    faturamento_total = 0
    faturamento_mes = 0
    total_clientes = len(confirmados)
    
    # Pega o ano e mês atual (ex: '2026-02') para filtrar
    mes_atual = datetime.datetime.now().strftime('%Y-%m')
    
    for servico, data in confirmados:
        valor = precos_base.get(servico, 0)
        faturamento_total += valor
        
        # Se o agendamento for deste mês, soma no faturamento mensal
        if data.startswith(mes_atual):
            faturamento_mes += valor
            
    return jsonify({
        "faturamento_total": faturamento_total,
        "faturamento_mes": faturamento_mes,
        "total_clientes": total_clientes
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)