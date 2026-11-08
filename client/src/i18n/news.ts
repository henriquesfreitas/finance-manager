import { getInitialBillsLanguage, saveBillsLanguage, type BillsLanguage } from './bills';

export type NewsLanguage = BillsLanguage;
export const getInitialNewsLanguage = getInitialBillsLanguage;
export const saveNewsLanguage = saveBillsLanguage;

export const newsCopy = {
  en: {
    pageTitle: 'News', investments: 'Investments', bills: 'Bills Control', budgets: 'Budgets', mainNavigation: 'Main navigation',
    loading: 'Loading saved stories\u2026', syncing: 'Checking the InfoMoney feed\u2026',
    loadError: 'Unable to load saved stories.', syncError: 'Unable to check the feed. Previously saved stories are still available.',
    emptyTitle: 'No stories have been imported yet', emptyDescription: 'The feed will be checked automatically when this page opens.',
    noIncluded: 'There are no included stories yet.', includedStories: 'Stories selected by categories', excludedStories: 'Excluded categories',
    openStory: 'Open article', expandSummary: 'Show summary', collapseSummary: 'Hide summary', summary: 'Summary',
    showOriginalText: 'Show original article text', hideOriginalText: 'Hide original article text', originalArticleText: 'Original article text',
    originalTextLoading: 'Loading article text\u2026', originalTextError: 'Unable to load article text.', originalTextEmpty: 'No article text is available for this story.',
    sourceFullArticle: 'Full article text used', sourceRssOnly: 'RSS text only', sourceNotFetched: 'Article not fetched', sourceUnknown: 'Source not recorded', sourceChecking: 'Checking article access\u2026',
    summaryPending: 'Summary is being generated\u2026', summaryFailed: 'Summary is unavailable. It will be retried the next time you open this page.',
    syncCounts: (feed: number, included: number, excluded: number) => `Latest feed check: ${String(feed)} stories found, ${String(included)} included, ${String(excluded)} excluded.`,
    summaryProgress: (ready: number, total: number, processing: number, pending: number) =>
      `Summaries ready: ${String(ready)} of ${String(total)}${processing + pending > 0 ? ` (${String(processing + pending)} in progress)` : ''}.`,
    language: 'Language', english: 'English', portuguese: 'Portugu\u00eas (Brasil)', signOut: 'Sign out', feedLink: 'InfoMoney RSS feed',
  },
  pt: {
    pageTitle: 'Not\u00edcias', investments: 'Investimentos', bills: 'Controle de contas', budgets: 'Or\u00e7amentos', mainNavigation: 'Menu principal',
    loading: 'Carregando not\u00edcias salvas\u2026', syncing: 'Verificando o feed do InfoMoney\u2026',
    loadError: 'N\u00e3o foi poss\u00edvel carregar as not\u00edcias salvas.', syncError: 'N\u00e3o foi poss\u00edvel verificar o feed. As not\u00edcias salvas continuam dispon\u00edveis.',
    emptyTitle: 'Ainda n\u00e3o h\u00e1 not\u00edcias importadas', emptyDescription: 'O feed ser\u00e1 verificado automaticamente ao abrir esta p\u00e1gina.',
    noIncluded: 'Ainda n\u00e3o h\u00e1 not\u00edcias inclu\u00eddas.', includedStories: 'Not\u00edcias selecionadas pelas categorias', excludedStories: 'Categorias exclu\u00eddas',
    openStory: 'Abrir not\u00edcia', expandSummary: 'Mostrar resumo', collapseSummary: 'Ocultar resumo', summary: 'Resumo',
    showOriginalText: 'Mostrar texto original da not\u00edcia', hideOriginalText: 'Ocultar texto original da not\u00edcia', originalArticleText: 'Texto original da not\u00edcia',
    originalTextLoading: 'Carregando texto da not\u00edcia\u2026', originalTextError: 'N\u00e3o foi poss\u00edvel carregar o texto da not\u00edcia.', originalTextEmpty: 'N\u00e3o h\u00e1 texto dispon\u00edvel para esta not\u00edcia.',
    sourceFullArticle: 'Texto completo usado', sourceRssOnly: 'Somente texto do RSS', sourceNotFetched: 'Not\u00edcia n\u00e3o acessada', sourceUnknown: 'Origem n\u00e3o registrada', sourceChecking: 'Verificando acesso \u00e0 not\u00edcia\u2026',
    summaryPending: 'O resumo est\u00e1 sendo gerado\u2026', summaryFailed: 'O resumo est\u00e1 indispon\u00edvel. Uma nova tentativa ser\u00e1 feita na pr\u00f3xima vez que voc\u00ea abrir esta p\u00e1gina.',
    syncCounts: (feed: number, included: number, excluded: number) => `\u00daltima verifica\u00e7\u00e3o do feed: ${String(feed)} not\u00edcias encontradas, ${String(included)} inclu\u00eddas, ${String(excluded)} exclu\u00eddas.`,
    summaryProgress: (ready: number, total: number, processing: number, pending: number) =>
      `Resumos prontos: ${String(ready)} de ${String(total)}${processing + pending > 0 ? ` (${String(processing + pending)} em andamento)` : ''}.`,
    language: 'Idioma', english: 'English', portuguese: 'Portugu\u00eas (Brasil)', signOut: 'Sair', feedLink: 'Feed RSS do InfoMoney',
  },
} as const;
