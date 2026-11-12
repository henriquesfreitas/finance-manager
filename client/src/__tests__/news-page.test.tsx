import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NewsPage } from '../pages/NewsPage';

const mocks = vi.hoisted(() => ({
  admin: { id: 'admin-1', username: 'admin_finance', permissions: ['NEWS'] as string[] },
  logout: vi.fn(),
  useNews: vi.fn(),
  useNewsOriginalText: vi.fn(),
  useSummarizeNews: vi.fn(),
  useSyncNews: vi.fn(),
  mutate: vi.fn(),
  summarizeMutate: vi.fn(),
}));

vi.mock('../contexts/auth-context', () => ({ useAuth: () => ({ admin: mocks.admin, logout: mocks.logout }) }));
vi.mock('../hooks/useNews', () => ({
  useNews: mocks.useNews,
  useNewsOriginalText: mocks.useNewsOriginalText,
  useSummarizeNews: mocks.useSummarizeNews,
  useSyncNews: mocks.useSyncNews,
}));
vi.mock('../components/ThemeToggle', () => ({ ThemeToggle: () => <button type="button">Theme</button> }));

const article = {
  id: 'included-1', title: 'Economic policy', link: 'https://www.infomoney.com.br/policy/',
  publishedAt: '2026-11-08T12:00:00.000Z', contentStatus: 'READY' as const, contentSource: 'FULL_ARTICLE' as const,
  summary: null, summaryStatus: 'PENDING' as const,
};

const data = {
  included: [article],
  excluded: [{
    id: 'excluded-1', title: 'Sports story', link: 'https://www.infomoney.com.br/sports/',
    publishedAt: '2026-11-08T11:00:00.000Z', contentSource: 'NOT_FETCHED' as const,
  }],
  progress: { total: 1, ready: 1, pending: 0, processing: 0, failed: 0 },
};

function expandArticle(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Economic policy' }));
}

beforeEach(() => {
  localStorage.clear();
  mocks.useNews.mockReturnValue({ data, isLoading: false, isError: false });
  mocks.useNewsOriginalText.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  mocks.useSummarizeNews.mockReturnValue({ mutate: mocks.summarizeMutate, data: undefined, isPending: false, isError: false });
  mocks.useSyncNews.mockReturnValue({
    mutate: mocks.mutate,
    data: { feedCount: 10, includedCount: 6, excludedCount: 4, addedCount: 3 },
    isPending: false,
    isError: false,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('NewsPage', () => {
  it('syncs the feed automatically on entry and shows latest check counts', () => {
    render(<NewsPage />);
    expect(mocks.mutate).toHaveBeenCalledOnce();
    expect(screen.getByText('Latest feed check: 10 stories found, 6 included, 4 excluded.')).toBeInTheDocument();
    expect(screen.getByText('Article texts saved: 1 of 1.')).toBeInTheDocument();
    expect(screen.getByText('Full article text')).toBeInTheDocument();
    expect(screen.getByText('Article not fetched')).toBeInTheDocument();
  });

  it('loads and formats the saved article text with paragraphs when expanded', () => {
    mocks.useNewsOriginalText.mockImplementation((_id: string, enabled: boolean) => enabled
      ? { data: { text: 'First paragraph of the story.\n\nSecond paragraph of the story.', source: 'FULL_ARTICLE' }, isLoading: false, isError: false }
      : { data: undefined, isLoading: false, isError: false });
    render(<NewsPage />);

    expect(mocks.useNewsOriginalText).toHaveBeenCalledWith('included-1', false);
    expandArticle();
    expect(mocks.useNewsOriginalText).toHaveBeenLastCalledWith('included-1', true);
    expect(screen.getByText('First paragraph of the story.').tagName).toBe('P');
    expect(screen.getByText('Second paragraph of the story.').tagName).toBe('P');
    expect(screen.getByRole('link', { name: /open article/i })).toHaveAttribute('href', 'https://www.infomoney.com.br/policy/');
  });

  it('always shows the AI summary link, even before the article is expanded', () => {
    render(<NewsPage />);
    expect(screen.getByRole('button', { name: 'Show AI summary' })).toBeInTheDocument();
    expect(screen.queryByText('AI summary')).not.toBeInTheDocument();
    expandArticle();
    expect(screen.queryByText('AI summary')).not.toBeInTheDocument();
  });

  it('loads the summary when the title is expanded but only shows it after the AI link is clicked', () => {
    mocks.useNewsOriginalText.mockReturnValue({ data: { text: 'Saved article text.', source: 'FULL_ARTICLE' }, isLoading: false, isError: false });
    render(<NewsPage />);

    expect(mocks.summarizeMutate).not.toHaveBeenCalled();
    expandArticle();
    expect(mocks.summarizeMutate).toHaveBeenCalledOnce();
    expect(screen.queryByText('AI summary')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show AI summary' }));
    expect(screen.getByRole('button', { name: 'Hide AI summary' })).toBeInTheDocument();
  });

  it('shows a saved summary only after the AI summary link is clicked', () => {
    mocks.useNews.mockReturnValue({
      data: { ...data, included: [{ ...article, summary: 'Saved summary.', summaryStatus: 'READY' }] },
      isLoading: false,
      isError: false,
    });
    mocks.useNewsOriginalText.mockReturnValue({ data: { text: 'Saved article text.', source: 'FULL_ARTICLE' }, isLoading: false, isError: false });
    render(<NewsPage />);

    expect(screen.queryByText('Saved summary.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show AI summary' }));
    expect(screen.getByText('AI summary')).toBeInTheDocument();
    expect(screen.getByText('Saved summary.')).toBeInTheDocument();
  });

  it('shows summary generation status and failure states', () => {
    mocks.useNewsOriginalText.mockReturnValue({ data: { text: 'Saved article text.', source: 'FULL_ARTICLE' }, isLoading: false, isError: false });
    mocks.useSummarizeNews.mockReturnValue({ mutate: mocks.summarizeMutate, data: undefined, isPending: true, isError: false });
    const { rerender } = render(<NewsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Show AI summary' }));
    expect(screen.getByText('Generating summary\u2026')).toBeInTheDocument();

    mocks.useSummarizeNews.mockReturnValue({ mutate: mocks.summarizeMutate, data: undefined, isPending: false, isError: true });
    rerender(<NewsPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to generate the summary. Try again.');
    expect(screen.getByRole('button', { name: 'Summarize with AI' })).toBeInTheDocument();
  });

  it('shows content saving, failure, and RSS fallback states', () => {
    mocks.useNews.mockReturnValue({
      data: { ...data, included: [{ ...article, contentStatus: 'PROCESSING', contentSource: null }] },
      isLoading: false,
      isError: false,
    });
    const { rerender } = render(<NewsPage />);
    expandArticle();
    expect(screen.getByText('Saving the article text\u2026')).toBeInTheDocument();

    mocks.useNews.mockReturnValue({
      data: { ...data, included: [{ ...article, contentStatus: 'FAILED', contentSource: null }] },
      isLoading: false,
      isError: false,
    });
    rerender(<NewsPage />);
    expect(screen.getByText('The article text could not be saved.')).toBeInTheDocument();

    mocks.useNews.mockReturnValue({
      data: { ...data, included: [{ ...article, contentSource: 'RSS_ONLY' }] },
      isLoading: false,
      isError: false,
    });
    rerender(<NewsPage />);
    expect(screen.getByText('RSS text only')).toBeInTheDocument();
  });

  it('shows excluded stories at the bottom with their article link and access status', () => {
    render(<NewsPage />);
    expect(screen.getByRole('heading', { name: 'Excluded categories' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sports story/i })).toHaveAttribute('href', 'https://www.infomoney.com.br/sports/');
    expect(screen.getAllByRole('time')).toHaveLength(1);
  });

  it('keeps saved stories visible when feed sync fails', () => {
    mocks.useSyncNews.mockReturnValue({ mutate: mocks.mutate, isPending: false, isError: true });
    render(<NewsPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Previously saved stories are still available.');
    expect(screen.getByRole('button', { name: 'Economic policy' })).toBeInTheDocument();
  });

  it('preserves the English and Portuguese page copy', () => {
    localStorage.setItem('finance-manager:bills-language', 'pt');
    render(<NewsPage />);
    expect(screen.getByText('Feed RSS do InfoMoney')).toBeInTheDocument();
  });
});
