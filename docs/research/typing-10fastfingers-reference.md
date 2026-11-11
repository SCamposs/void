# Typing do VOID: investigação do 10FastFingers em português

Data: 2026-11-10. Referência: [teste de português](https://10fastfingers.com/pt/typing-test/portuguese). Escopo: investigar o comportamento público e melhorar o módulo local do VOID. Não estabelece equivalência exata com o motor do serviço.

## Método e limites

A página foi aberta em um navegador e exercitada com caracteres corretos, erros, Backspace e Espaço. O teste começou no primeiro texto, apresentou feedback por caractere e duas linhas de palavras. Entre experimentos separados por inatividade, a sequência foi reiniciada pelo site. Portanto, experimentos posteriores não foram tratados como continuação da sequência inicial. Não houve login, envio manual de resultado, acesso a código privado ou interação com anúncios.

O HTML público identifica os chunks JavaScript entregues ao navegador. Foram baixados por HTTP comum e lidos estaticamente, especialmente o motor de digitação e o componente de entrada/áudio. Cópias locais ficam fora do Git em `../targets/typing-inspection/web/`. Essa análise permite inspecionar regras do cliente, mas não comprova validação, classificação ou persistência do servidor.

Recursos identificados na captura, sujeitos a alteração pelo site:

| URL relativa em 10fastfingers.com | SHA-256 do arquivo local capturado |
| --- | --- |
| `/_next/static/chunks/16xnfltgs8mtp.js` | `18f2b822981cd2cbc8a7c9ea2453bedc0c49ad8118874a4935f95ab37f832568` |
| `/_next/static/chunks/0f07gezwph-y8.js` | `a040f103abb90573008bd16f8ffcb94d0341bb9ee1be9a298513da3aaeece936` |

Os hashes correspondem às cópias textuais locais, gravadas em UTF-8, e não garantem identidade de bytes com a transferência HTTP original.

## O que foi estabelecido

| Evidência | Conclusão limitada |
| --- | --- |
| Página e execução | Português, teste padrão de um minuto, fluxo de palavras e destaque de caracteres. A página explica a unidade convencional de cinco toques e diferencia vocabulário normal e ampliado. |
| Componente de entrada | Há tratamento explícito de composição, teclas mortas, correção, troca de palavra, foco e término. A implementação é mais rica que um simples input com contador. |
| Motor público | Distingue palavras corretas/erradas, caracteres omitidos/extras, modificações, espaços e toques. Usa crédito de toques por caractere/idioma, inclusive tratamento de composição. Não é apenas a quantidade de palavras dividida pelo minuto. |
| Motor público, rotina AFK | Expõe aviso após cinco segundos, reset após dez segundos e orçamento de pausas proporcional à duração, quando detecção AFK está habilitada. Isso é diferente do reset do antigo VOID após cinco segundos. |
| Áudio no componente público | Existem amostras de teclas, espaço, Backspace, acerto e erro, ligadas às opções de intensidade. As amostras não foram incorporadas ao VOID. |

Não foi recuperado um corpus integral de palavras nem feita medição acústica das amostras do site. A versão atual do site não deve ser confundida com implementações históricas do 10FastFingers. Os nomes e rotinas foram usados como evidência de comportamento; o código de produção do VOID foi escrito no projeto.

## Decisões para o VOID

- Preservar preto, branco glacial, Barlow/Urbanist, controles compartilhados e composição aberta. Palavras são o foco; histórico e análises ficam em planos secundários.
- Oferecer palavras comuns por padrão e manter o vocabulário amplo existente. As listas comuns PT-BR e EN são seleções próprias, não cópias do corpus do site nem rankings estatísticos de frequência. Evitar repetição adjacente quando houver alternativas.
- Medir a posição real das palavras no DOM, incluindo carregamento de fontes e redimensionamento, para manter duas linhas visíveis. Repor palavras antes de esgotar a sequência.
- Começar no primeiro caractere confirmado; ignorar espaços vazios e teclas de navegação. Backspace fica limitado à palavra atual. Ctrl+Enter reinicia; Tab conserva a navegação normal.
- Normalizar acentos em NFC e aguardar o fim da composição antes de registrar caracteres. Bloquear colagem e arrastar texto no campo do teste.
- Usar prazo monotônico com `performance.now()` e rejeitar entrada a partir do limite, mesmo antes do próximo callback do relógio. O tempo continua quando o campo perde foco. Inatividade não destrói a tentativa.
- Calcular PPM por caracteres de palavras inteiramente corretas, incluindo o espaço confirmado dessas palavras. Palavra completa no limite vale sem espaço; fragmento não rende velocidade e não recebe punição por um sufixo ainda não tentado. A precisão registra erros corrigidos e omissões confirmadas. Isso é uma regra documentada do VOID, não reprodução do crédito por teclas físicas do 10FastFingers.
- Separar recordes por idioma, duração, vocabulário e versão de regra (`word-flow-v2-*`). Histórico anterior permanece legível e identificado, sem entrar na comparação nova.
- Manter gráfico, histórico de digitação, mapas e métricas detalhadas, agora com controles nomeados e textos em português. O gráfico indica ritmo de toques em janelas de cinco segundos; essa medida não é a nota final por palavras corretas.
- Permitir treino específico de palavras erradas ou corrigidas na tentativa recém-concluída, com recordes separados do modo comum.
- Sintetizar sons originais e breves via Web Audio: tecla, confirmação, erro e conclusão. Desligado por padrão, volume persistido, amostra acessível e limite de vozes. Não há downloads de áudio ou requisições de rede para digitar.

Ranking público, contas, anúncios, compartilhamento social, efeitos de intensidade e detecção anti-AFK do serviço não ajudam o propósito local do VOID e ficaram fora desta implementação.

## Validação

Regressões são cobertas em `desktop/src/tests/typingSession.test.ts`, `typingWords.test.ts`, `typingEngine.test.ts` e `desktop/e2e/typing-refinement.spec.ts`. A suíte visual compartilhada acompanha os novos nomes acessíveis em português.

As verificações incluem prazo real de 15 segundos, uma gravação por término, crédito por palavra, acentos decompostos, correção intermediária, omissões, espaços repetidos, inatividade, revisão de erros, som e preferências, colagem, foco e duas larguras de janela. Evidência visual local: `../targets/typing-inspection/validation/`.

Resultado: `npm run build`, `npm run lint` e os 146 testes de `npm test` passaram. Os quatro cenários de Typing e os seis cenários da fundação visual passaram juntos; após os últimos ajustes de áudio e compatibilidade do histórico, os quatro cenários específicos foram executados novamente com sucesso. O teste de áudio instrumenta a criação real dos osciladores no navegador, verifica emissão após ativar/amostrar e ausência de novas vozes ao digitar silenciado. Capturas de 1280×800 e 760×600 foram inspecionadas, com acentos legíveis e palavra ativa dentro do visor.

Os testes de navegador validam o frontend em Chromium. Não substituem digitação humana com todos os drivers/IME de Windows, avaliação subjetiva do som ou aprovação visual do criador. A etapa inicial de implementação não publicou instaladores. A publicação posteriormente autorizada é descrita nas [notas da v0.5.0-alpha](../releases/v0.5.0-alpha.md) e usa o pipeline existente.
