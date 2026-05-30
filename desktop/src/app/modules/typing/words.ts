export const PT_BR_WORDS: string[] = [
  "casa","tempo","mundo","pessoa","vida","trabalho","escola","noite","dia","codigo","projeto","sistema","texto","palavra","tela","janela","musica","cidade","caminho","energia","amigo","familia","historia","internet","terminal","arquivo","teclado","monitor","programa","funcao","classe","objeto","banco","dados","rede","comando","modulo","teste","desafio","foco","rotina","metodo","versao","bug","ajuste","build","deploy","fluxo","linha","lista","pilha","fila","rapido","lento","claro","escuro","preto","branco","curto","longo","ponto","virgula","teoria","pratica","inicio","meio","fim","porta","chave","senha","nuvem","local","ferramenta","valor","nome","dado","filtro","busca","tarefa",
  "tecnica","processo","equipe","progresso","memoria","leitura","escrita","contexto","camada","pacote","evento","estado","interface","componente","persistencia","historico","resultado","objetivo","jornada","conexao"
];

export function generateWordSequence(count = 450): string[] {
  return Array.from({ length: Math.max(0, count) }, () => PT_BR_WORDS[Math.floor(Math.random() * PT_BR_WORDS.length)]);
}
