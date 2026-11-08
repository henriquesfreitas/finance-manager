import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NewsPage } from '../pages/NewsPage';

const mocks = vi.hoisted(() => ({
  admin: { id: 'admin-1', username: 'admin_finance', permissions: ['NEWS'] as string[] },
  logout: vi.fn(),
  useNews: vi.fn(),
  useNewsOriginalText: vi.fn(),
  useSyncNews: vi.fn(),
  mutate: vi.fn(),
}));

vi.mock('../contexts/auth-context', () => ({ useAuth: () => ({ admin: mocks.admin, logout: mocks.logout }) }));
vi.mock('../hooks/useNews', () => ({ useNews: mocks.useNews, useNewsOriginalText: mocks.useNewsOriginalText, useSyncNews: mocks.useSyncNews }));
vi.mock('../components/ThemeToggle', () => ({ ThemeToggle: () => <button type="button">Theme</button> }));

const data = {
  included: [{
    id: 'included-1', title: 'Economic policy', link: 'https://www.infomoney.com.br/policy/',
    publishedAt: '2026-11-08T12:00:00.000Z', summary: 'Saved summary.', summaryStatus: 'READY' as const, summarySource: 'FULL_ARTICLE' as const,
  }],
  excluded: [{
    id: 'excluded-1', title: 'Sports story', link: 'https://www.infomoney.com.br/sports/',
    publishedAt: '2026-11-08T11:00:00.000Z', summarySource: 'NOT_FETCHED' as const,
  }],
  progress: { total: 1, ready: 1, pending: 0, processing: 0, failed: 0 },
};

beforeEach(() => {
  localStorage.clear();
  mocks.useNews.mockReturnValue({ data, isLoading: false, isError: false });
  mocks.useNewsOriginalText.mockReturnValue({ data: undefined, isLoading: false, isError: false });
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
    expect(screen.getByText('Full article text used')).toBeInTheDocument();
    expect(screen.getByText('Article not fetched')).toBeInTheDocument();
  });

  it('expands the saved summary below the title and keeps a separate article link', () => {
    render(<NewsPage />);
    const title = screen.getByRole('button', { name: 'Economic policy' });
    expect(title).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(title);
    expect(screen.getByText('Saved summary.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Economic policy' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /open article/i })).toHaveAttribute('href', 'https://www.infomoney.com.br/policy/');
  });

  it('loads the original article text only when requested and reuses it when reopened', () => {
    mocks.useNewsOriginalText.mockImplementation((_id: string, enabled: boolean) => enabled
      ? { data: { text: 'Original text from the article.', source: 'FULL_ARTICLE' }, isLoading: false, isError: false }
      : { data: undefined, isLoading: false, isError: false });
    render(<NewsPage />);

    expect(mocks.useNewsOriginalText).toHaveBeenCalledWith('included-1', false);
    fireEvent.click(screen.getByRole('button', { name: 'Economic policy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show original article text' }));
    expect(mocks.useNewsOriginalText).toHaveBeenLastCalledWith('included-1', true);
    expect(screen.getByText('Original text from the article.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide original article text' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show original article text' }));
    expect(screen.getByText('Original text from the article.')).toBeInTheDocument();
    expect(screen.getAllByText('Full article text used')).toHaveLength(2);
  });

  it('shows excluded stories at the bottom with their article link and access status', () => {
    render(<NewsPage />);
    expect(screen.getByRole('heading', { name: 'Excluded categories' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sports story/i })).toHaveAttribute('href', 'https://www.infomoney.com.br/sports/');
    expect(screen.getAllByRole('time')).toHaveLength(1);
  });

  it('shows when a summary used only the RSS text', () => {
    mocks.useNews.mockReturnValue({
      data: { ...data, included: [{ ...data.included[0]!, summarySource: 'RSS_ONLY' }] },
      isLoading: false,
      isError: false,
    });
    render(<NewsPage />);
    expect(screen.getByText('RSS text only')).toBeInTheDocument();
  });

  it('shows pending and failed summary states when a story is expanded', () => {
    mocks.useNews.mockReturnValue({
      data: { ...data, included: [{ ...data.included[0]!, summary: null, summaryStatus: 'PROCESSING' }] },
      isLoading: false,
      isError: false,
    });
    const { rerender } = render(<NewsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Economic policy' }));
    expect(screen.getByText('Summary is being generated\u2026')).toBeInTheDocument();

    mocks.useNews.mockReturnValue({
      data: { ...data, included: [{ ...data.included[0]!, summary: null, summaryStatus: 'FAILED' }] },
      isLoading: false,
      isError: false,
    });
    rerender(<NewsPage />);
    expect(screen.getByText(/It will be retried the next time you open this page/)).toBeInTheDocument();
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
