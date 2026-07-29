export const PT_BR_WORDS: string[] = [
  "casa","tempo","mundo","pessoa","vida","trabalho","escola","noite","dia","codigo","projeto","sistema","texto","palavra","tela","janela","musica","cidade","caminho","energia","amigo","familia","historia","internet","terminal","arquivo","teclado","monitor","programa","funcao","classe","objeto","banco","dados","rede","comando","modulo","teste","desafio","foco","rotina","metodo","versao","bug","ajuste","build","deploy","fluxo","linha","lista","pilha","fila","rapido","lento","claro","escuro","preto","branco","curto","longo","ponto","virgula","teoria","pratica","inicio","meio","fim","porta","chave","senha","nuvem","local","ferramenta","valor","nome","dado","filtro","busca","tarefa",
  "tecnica","processo","equipe","progresso","memoria","leitura","escrita","contexto","camada","pacote","evento","estado","interface","componente","persistencia","historico","resultado","objetivo","jornada","conexao"
];

export const EN_WORDS: string[] = [
  "time","world","person","life","work","school","night","day","code","project","system","text","word","screen","window","music","city","path","signal","friend","family","story","local","file","keyboard","monitor","program","function","class","object","data","network","command","module","test","focus","routine","method","version","issue","flow","line","list","queue","quick","slow","clear","dark","white","short","long","point","theory","practice","start","middle","finish","door","key","cloud","tool","value","name","filter","search","task","process","memory","reading","writing","context","layer","package","event","state","interface","component","history","result","goal","journey","connection","quiet","motion","sound","board","input","output","change","build","release","source","shape","space","light","field","core","orbit",
];

export type TypingLanguage = "pt-BR" | "en";

export function generateWordSequence(count = 450, language: TypingLanguage = "pt-BR"): string[] {
  const pool = language === "en" ? EN_WORDS : PT_BR_WORDS;
  return Array.from({ length: Math.max(0, count) }, () => pool[Math.floor(Math.random() * pool.length)]);
}
