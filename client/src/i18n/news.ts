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
    openStory: 'Open article', articleText: 'Article text', summarize: 'Summarize with AI', summary: 'AI summary',
    showSummary: 'Show AI summary', hideSummary: 'Hide AI summary',
    articleTextPending: 'Saving the article text\u2026', articleTextLoading: 'Loading the article text\u2026',
    articleTextError: 'Unable to load the article text.', articleTextFailed: 'The article text could not be saved.',
    articleTextEmpty: 'No article text is available for this story.',
    summaryPending: 'Generating summary\u2026', summaryFailed: 'Unable to generate the summary. Try again.',
    sourceFullArticle: 'Full article text', sourceRssOnly: 'RSS text only', sourceNotFetched: 'Article not fetched',
    sourceChecking: 'Saving text\u2026', sourceFailed: 'Article text unavailable',
    syncCounts: (feed: number, included: number, excluded: number) => `Latest feed check: ${String(feed)} stories found, ${String(included)} included, ${String(excluded)} excluded.`,
    contentProgress: (ready: number, total: number, processing: number, pending: number) =>
      `Article texts saved: ${String(ready)} of ${String(total)}${processing + pending > 0 ? ` (${String(processing + pending)} in progress)` : ''}.`,
    language: 'Language', english: 'English', portuguese: 'Portugu\u00eas (Brasil)', signOut: 'Sign out', feedLink: 'InfoMoney RSS feed',
  },
  pt: {
    pageTitle: 'Not\u00edcias', investments: 'Investimentos', bills: 'Controle de contas', budgets: 'Or\u00e7amentos', mainNavigation: 'Menu principal',
    loading: 'Carregando not\u00edcias salvas\u2026', syncing: 'Verificando o feed do InfoMoney\u2026',
    loadError: 'N\u00e3o foi poss\u00edvel carregar as not\u00edcias salvas.', syncError: 'N\u00e3o foi poss\u00edvel verificar o feed. As not\u00edcias salvas continuam dispon\u00edveis.',
    emptyTitle: 'Ainda n\u00e3o h\u00e1 not\u00edcias importadas', emptyDescription: 'O feed ser\u00e1 verificado automaticamente ao abrir esta p\u00e1gina.',
    noIncluded: 'Ainda n\u00e3o h\u00e1 not\u00edcias inclu\u00eddas.', includedStories: 'Not\u00edcias selecionadas pelas categorias', excludedStories: 'Categorias exclu\u00eddas',
    openStory: 'Abrir not\u00edcia', articleText: 'Texto da not\u00edcia', summarize: 'Resumir com IA', summary: 'Resumo por IA',
    showSummary: 'Mostrar resumo por IA', hideSummary: 'Ocultar resumo por IA',
    articleTextPending: 'Salvando o texto da not\u00edcia\u2026', articleTextLoading: 'Carregando o texto da not\u00edcia\u2026',
    articleTextError: 'N\u00e3o foi poss\u00edvel carregar o texto da not\u00edcia.', articleTextFailed: 'N\u00e3o foi poss\u00edvel salvar o texto da not\u00edcia.',
    articleTextEmpty: 'N\u00e3o h\u00e1 texto dispon\u00edvel para esta not\u00edcia.',
    summaryPending: 'Gerando resumo\u2026', summaryFailed: 'N\u00e3o foi poss\u00edvel gerar o resumo. Tente novamente.',
    sourceFullArticle: 'Texto completo da not\u00edcia', sourceRssOnly: 'Somente texto do RSS', sourceNotFetched: 'Not\u00edcia n\u00e3o acessada',
    sourceChecking: 'Salvando texto\u2026', sourceFailed: 'Texto da not\u00edcia indispon\u00edvel',
    syncCounts: (feed: number, included: number, excluded: number) => `\u00daltima verifica\u00e7\u00e3o do feed: ${String(feed)} not\u00edcias encontradas, ${String(included)} inclu\u00eddas, ${String(excluded)} exclu\u00eddas.`,
    contentProgress: (ready: number, total: number, processing: number, pending: number) =>
      `Textos das not\u00edcias salvos: ${String(ready)} de ${String(total)}${processing + pending > 0 ? ` (${String(processing + pending)} em andamento)` : ''}.`,
    language: 'Idioma', english: 'English', portuguese: 'Portugu\u00eas (Brasil)', signOut: 'Sair', feedLink: 'Feed RSS do InfoMoney',
  },
} as const;
