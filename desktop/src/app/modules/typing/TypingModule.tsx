import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button, Select, Slider, Disclosure, DisclosureTitle, DisclosureBody } from "../../components/ui/Controls";
import { useConfirm } from "../../components/ui/use-confirm";
import { readStoredJson, writeStoredJson, typingRepo } from "../../lib/persistence";
import { computeLiveWpm, computeTypingAccuracy, hasWordError } from "./engine";
import { confirmTypingWord, creditedCharacters, finishTypingRun, newTypingRun, updateTypingInput, type TypingRun } from "./session";
import { generateWordSequence, type TypingLanguage, type TypingVocabulary } from "./words";
import { TypingResults } from "./TypingResults";
import { TypingAudio } from "./audio";
import "./typing.css";

type Duration = 15 | 30 | 60 | 120;
type Preferences = { duration: Duration; language: TypingLanguage; vocabulary: TypingVocabulary; sound: boolean; volume: number };
const preferenceKey = "void.typing.preferences.v1";
function loadPreferences(): Preferences {
  const stored = readStoredJson<Partial<Preferences> | null>(preferenceKey, null);
  return { duration: [15, 30, 60, 120].includes(stored?.duration ?? 0) ? stored!.duration! : 60,
    language: stored?.language === "en" ? "en" : "pt-BR",
    vocabulary: stored?.vocabulary === "varied" ? "varied" : "common",
    sound: stored?.sound === true,
    volume: typeof stored?.volume === "number" && Number.isFinite(stored.volume) ? Math.max(0, Math.min(100, stored.volume)) : 35 };
}
const vocabularyLabels = { common: "Palavras comuns", varied: "Vocabulário amplo", practice: "Revisão de erros" };
function sessionModeLabel(value: unknown) {
  const mode = typeof value === "string" ? value : "";
  return mode.includes("-practice-") ? "Revisão" : mode.includes("-common-") ? "Comuns" : mode.includes("-varied-") ? "Amplo" : "Regra anterior";
}

const WordFlow = memo(function WordFlow({ run, focused, onFocus }: { run: TypingRun; focused: boolean; onFocus(): void }) {
  const viewport = useRef<HTMLDivElement>(null);
  const flow = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const move = () => {
      const active = flow.current?.querySelector<HTMLElement>("[data-active]");
      if (active && viewport.current) viewport.current.scrollTop = active.offsetTop;
    };
    move();
    const observer = new ResizeObserver(move);
    if (viewport.current) observer.observe(viewport.current);
    let cancelled = false;
    void document.fonts.ready.then(() => { if (!cancelled) move(); });
    return () => { cancelled = true; observer.disconnect(); };
  }, [run.index, run.input, run.words]);

  return <div className={`typing-field ${focused ? "is-focused" : ""}`} onClick={onFocus} role="group" aria-label="Palavras do teste">
    <div ref={viewport} className="typing-viewport" aria-hidden="true">
      <div ref={flow} className="typing-flow">
        {run.words.map((word, index) => {
          const trace = run.traces[index];
          if (index !== run.index) return <span key={index} data-word={index} className={`typing-word ${trace ? trace.isCorrectWord ? "is-correct" : "is-wrong" : ""}`}>{word}</span>;
          return <span key={index} data-active data-word={index} className="typing-word is-active">
            {Array.from(word).map((character, i) => <span key={i} className={`${i === run.input.length ? "typing-caret" : ""} ${i < run.input.length ? run.input[i] === character ? "char-correct" : "char-wrong" : ""}`}>{character}</span>)}
            {run.input.slice(word.length).split("").map((character, i) => <span className="char-wrong" key={`extra-${i}`}>{character}</span>)}
            {run.input.length >= word.length && <span className="typing-caret typing-caret-end" />}
          </span>;
        })}
      </div>
    </div>
    {!focused && <Button className="typing-resume" onClick={onFocus}>Clique para digitar</Button>}
  </div>;
});

export function TypingModule() {
  const confirm = useConfirm();
  const [preferences, setPreferences] = useState(loadPreferences);
  const [run, setRun] = useState(() => newTypingRun(generateWordSequence(400, preferences.language, preferences.vocabulary)));
  const current = useRef(run);
  const inputRef = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const [composition, setComposition] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState("");
  const [sessions, setSessions] = useState(() => typingRepo.all());
  const [practiceWords, setPracticeWords] = useState<string[]>([]);
  const audio = useRef<TypingAudio | null>(null);
  const recorded = useRef(false);
  const active = run.startedAt !== null && !run.finished;
  const { duration, language, vocabulary, sound, volume } = preferences;
  const mode = `word-flow-v2-${vocabulary}-${duration}s`;
  const selectedSessions = sessions.filter(session => session.durationSeconds === duration && session.language === language && session.mode === mode);
  const best = Math.max(0, ...selectedSessions.map(session => session.wpm));
  const speedLabel = language === "pt-BR" ? "PPM" : "WPM";
  const score = creditedCharacters(run.traces);
  const accuracy = computeTypingAccuracy(run.events, run.traces);
  const play = useCallback((kind: "key" | "space" | "error" | "finish") => {
    if (sound) (audio.current ??= new TypingAudio()).play(kind, volume);
  }, [sound, volume]);
  const commit = useCallback((next: TypingRun) => { current.current = next; setRun(next); }, []);
  const focusInput = useCallback(() => inputRef.current?.focus(), []);

  useEffect(() => { inputRef.current?.focus(); return () => audio.current?.close(); }, []);
  useEffect(() => { writeStoredJson(preferenceKey, preferences); }, [preferences]);
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const snapshot = current.current;
      if (snapshot.startedAt === null || snapshot.finished) return;
      const seconds = Math.min(duration, (performance.now() - snapshot.startedAt) / 1000);
      setElapsed(seconds);
      if (seconds >= duration) commit(finishTypingRun(snapshot, duration));
    };
    const id = window.setInterval(tick, 50);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [active, commit, duration]);
  useEffect(() => {
    if (!run.finished || recorded.current) return;
    recorded.current = true;
    typingRepo.save({ timestamp: new Date().toISOString(), wpm: computeLiveWpm(score, duration), accuracy,
      correctWords: run.traces.filter(trace => trace.isCorrectWord).length,
      incorrectWords: run.traces.filter(hasWordError).length,
      correctChars: score, incorrectChars: run.traces.reduce((sum, trace) => sum + trace.incorrectCharacters, 0),
      durationSeconds: duration, language, mode });
    setSessions(typingRepo.all());
    setPracticeWords([...new Set(run.traces.filter(trace => hasWordError(trace) || trace.corrections > 0).map(trace => trace.expectedWord))]);
    play("finish");
  }, [accuracy, duration, language, mode, play, run, score]);

  const restart = useCallback((nextPreferences = preferences, nextPractice = practiceWords) => {
    commit(newTypingRun(generateWordSequence(400, nextPreferences.language, nextPreferences.vocabulary, nextPractice)));
    setElapsed(0); setNotice(""); setComposition(null); composing.current = false; recorded.current = false;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [commit, preferences, practiceWords]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !composing.current &&
        !(event.target instanceof Element && event.target.closest('[role="dialog"], [role="alertdialog"]'))) {
        event.preventDefault(); restart();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [restart]);
  const configure = (change: Partial<Preferences>) => {
    const next = { ...preferences, ...change };
    setPreferences(next); restart(next);
  };
  const handleInput = (value: string) => {
    const previous = current.current;
    const next = updateTypingInput(previous, value, performance.now(), duration);
    if (next !== previous) {
      commit(next);
      if (!next.finished) {
        const last = next.events[next.events.length - 1];
        play(last?.type === "character" && last.classification !== "correct" ? "error" : "key");
      }
    }
  };
  const submit = () => {
    const previous = current.current;
    let next = confirmTypingWord(previous, performance.now(), duration);
    if (next === previous) return;
    if (!next.finished && next.index >= next.words.length - 40) next = { ...next,
      words: [...next.words, ...generateWordSequence(200, language, vocabulary, practiceWords)] };
    commit(next);
    if (!next.finished) play(next.traces[next.traces.length - 1]?.isCorrectWord ? "space" : "error");
  };

  return <div className={`typing-module ${active ? "is-running" : ""}`}>
    <section className="typing-main" aria-label="Teste de digitação">
      <header className="typing-toolbar">
        <div className="typing-configuration">
          <Select label="Duração" finalFocus={inputRef} value={duration} disabled={active} onValueChange={value => configure({ duration: Number(value) as Duration })}>
            {[15, 30, 60, 120].map(seconds => <option key={seconds} value={seconds}>{seconds}s</option>)}
          </Select>
          <Select label="Idioma" finalFocus={inputRef} value={language} disabled={active} onValueChange={value => configure({ language: value as TypingLanguage, vocabulary: "common" })}>
            <option value="pt-BR">Português BR</option><option value="en">English</option>
          </Select>
          <Select label="Vocabulário" finalFocus={inputRef} value={vocabulary} disabled={active} onValueChange={value => configure({ vocabulary: value as TypingVocabulary })}>
            <option value="common">Palavras comuns</option><option value="varied">Vocabulário amplo</option>
            {vocabulary === "practice" && <option value="practice">Revisão de erros</option>}
          </Select>
        </div>
        <Button className="typing-sound" aria-label={sound ? "Desativar som" : "Ativar som"} aria-pressed={sound} title={sound ? "Desativar som" : "Ativar som"} onClick={() => {
          setPreferences({ ...preferences, sound: !sound });
          if (!sound) (audio.current ??= new TypingAudio()).play("key", volume);
          inputRef.current?.focus();
        }}>{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</Button>
      </header>
      {!run.finished ? <div className="typing-stage">
        <div className="typing-live" aria-label="Progresso do teste">
          <span className="typing-timer" role="timer" aria-label="Tempo restante">{String(Math.floor(Math.ceil(duration - elapsed) / 60)).padStart(2, "0")}:{String(Math.ceil(duration - elapsed) % 60).padStart(2, "0")}</span>
          <span>{computeLiveWpm(score, Math.max(1, elapsed)).toFixed(0)} <span className="typing-unit">{speedLabel}</span></span>
          <span>{accuracy.toFixed(0)}<span className="typing-unit">% precisão</span></span>
          <span className="typing-state">{active ? "Encontre seu ritmo" : "Comece a digitar"}</span>
        </div>
        <WordFlow run={run} focused={focused} onFocus={focusInput} />
        <input ref={inputRef} className="sr-only" value={composition ?? run.input} aria-label={`Digite a palavra ${run.words[run.index]}`} aria-describedby="typing-instructions" autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={run.finished}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          onPaste={event => { event.preventDefault(); setNotice("A colagem está desativada durante o teste."); }}
          onDrop={event => event.preventDefault()}
          onCompositionStart={() => { composing.current = true; setComposition(current.current.input); }}
          onCompositionEnd={event => { composing.current = false; setComposition(null); handleInput(event.currentTarget.value); }}
          onChange={event => { if (composing.current || (event.nativeEvent as InputEvent).isComposing) setComposition(event.target.value); else handleInput(event.target.value); }}
          onKeyDown={event => {
            if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === " ") { event.preventDefault(); submit(); }
          }} />
        <div className="typing-instructions" id="typing-instructions"><span>Espaço confirma · Backspace corrige a palavra atual</span><span>Ctrl + Enter reinicia</span></div>
        <div className="typing-progress" role="progressbar" aria-label="Tempo decorrido" aria-valuenow={Math.floor(elapsed)} aria-valuemax={duration}><i style={{ transform: `scaleX(${elapsed / duration})` }} /></div>
        <div className="typing-stage-footer"><span role="status">{notice || (active ? `${run.traces.length} palavras confirmadas` : "O tempo começa no primeiro caractere. Acentos fazem parte do teste.")}</span>
          <Button onClick={() => restart()}><RotateCcw size={14} /> Reiniciar</Button>
        </div>
      </div> : <>
        <TypingResults traces={run.traces} events={run.events} duration={duration} wpm={computeLiveWpm(score, duration)} accuracy={accuracy} language={language} onRestart={() => restart()} />
        <div className="typing-result-actions"><span>Salvo no histórico local. {vocabularyLabels[vocabulary]} · {duration}s</span>
          {practiceWords.length > 0 && <Button onClick={() => { const next = { ...preferences, vocabulary: "practice" as const }; setPreferences(next); restart(next, practiceWords); }}>Praticar {practiceWords.length} palavras difíceis</Button>}
        </div>
      </>}
      <div className="typing-bottom">
        <Disclosure><DisclosureTitle>Ajustar som</DisclosureTitle><DisclosureBody>
          <div className="typing-audio-settings"><span>Volume {volume}%</span><Slider label="Volume do teclado" min={0} max={100} step={5} value={volume} onValueChange={value => setPreferences({ ...preferences, volume: value })} />
            <Button onClick={() => (audio.current ??= new TypingAudio()).play("key", volume)}>Ouvir amostra</Button></div>
          <p className="typing-explanation">Som sintetizado suave para teclas, confirmação, erro e conclusão. Desligado por padrão.</p>
        </DisclosureBody></Disclosure>
        <Disclosure><DisclosureTitle>Como o resultado é calculado</DisclosureTitle><DisclosureBody><p className="typing-explanation">{speedLabel} = caracteres de palavras inteiramente corretas ÷ 5 ÷ minutos. Espaços confirmados dessas palavras também contam. Uma palavra completa no último instante vale sem espaço; um fragmento não rende velocidade. A precisão considera erros corrigidos e letras omitidas ao confirmar. O relógio continua ao sair do campo. Resultados anteriores usam outra regra e ficam separados dos novos recordes.</p></DisclosureBody></Disclosure>
      </div>
    </section>
    <aside className="typing-history" aria-label="Histórico local">
      <h2>Seu ritmo</h2><p className="typing-history-mode">{vocabularyLabels[vocabulary]} · {duration}s · {language.toUpperCase()}</p>
      <dl className="typing-record"><div><dt>Melhor marca</dt><dd>{best ? best.toFixed(0) : "—"} <small>{speedLabel}</small></dd></div><div><dt>Testes neste modo</dt><dd>{selectedSessions.length}</dd></div></dl>
      <h3>Últimos testes</h3>
      {sessions.length === 0
        ? <p className="typing-explanation">Complete seu primeiro teste para acompanhar a evolução por aqui.</p>
        : <ol className="typing-session-list">{sessions.slice(0, 7).map((session, i) => <li key={`${session.timestamp}-${i}`}>
          <div><strong>{session.wpm.toFixed(0)} {session.language === "pt-BR" ? "PPM" : "WPM"}</strong><span>{session.accuracy.toFixed(0)}%</span></div>
          <p>{session.language} · {session.durationSeconds}s · {sessionModeLabel(session.mode)}</p>
          <time>{new Date(session.timestamp).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
        </li>)}</ol>}
      {sessions.length > 0 && <Button className="typing-clear" onClick={async () => {
        if (await confirm("Apagar todo o histórico de digitação?")) { typingRepo.reset(); setSessions([]); }
      }}>Apagar histórico</Button>}
    </aside>
  </div>;
}
