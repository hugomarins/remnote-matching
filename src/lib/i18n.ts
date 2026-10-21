/** The plugin's few strings, in English and Portuguese (chosen by the browser's language). */
const STRINGS = {
  en: {
    check: 'Check',
    again: 'Again',
    hard: 'Hard',
    good: 'Good',
    easy: 'Easy',
    suggested: 'Suggested rating',
    howTo: 'drag each item on the left onto its match (or tap it, then the match)',
    dragHint: 'Drag the card onto its group (or tap the group).',
    right: 'Right!',
    wrong: 'Not this one: the right group is in green.',
    linked: (n: number, total: number) => `${n}/${total} connected`,
    score: (n: number, total: number) => `${n} of ${total} right`,
    tooFew: 'This Matching card needs at least two children written as "left :: right".',
  },
  pt: {
    check: 'Conferir',
    again: 'Errei',
    hard: 'Difícil',
    good: 'Bom',
    easy: 'Fácil',
    suggested: 'Avaliação sugerida',
    howTo: 'arraste cada item da esquerda até o seu par (ou toque nele e depois no par)',
    dragHint: 'Arraste o cartão até o seu grupo (ou toque no grupo).',
    right: 'Certo!',
    wrong: 'Não é este: o grupo certo está em verde.',
    linked: (n: number, total: number) => `${n}/${total} conectados`,
    score: (n: number, total: number) => `${n} de ${total} certos`,
    tooFew: 'Este card de Matching precisa de pelo menos dois filhos no formato "esquerda :: direita".',
  },
};

type Key = keyof typeof STRINGS.en;

const lang = (): keyof typeof STRINGS =>
  typeof navigator !== 'undefined' && /^pt\b/i.test(navigator.language ?? '') ? 'pt' : 'en';

export function t(key: Key, ...args: number[]): string {
  const value = STRINGS[lang()][key] as string | ((...a: number[]) => string);
  return typeof value === 'function' ? value(...args) : value;
}
