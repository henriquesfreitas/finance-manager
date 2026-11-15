import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewsPage } from '../pages/NewsPage';
import { ThemeProvider } from '../contexts/theme-context';

const mocks = vi.hoisted(() => ({
  useNewsFeed: vi.fn(),
}));

vi.mock('../hooks/useNews', () => ({
  useNewsFeed: mocks.useNewsFeed,
}));

const DATA = {
  title: 'InfoMoney',
  lastBuildDate: 'Thu, 12 Nov 2026 01:00:52 +0000',
  filter: ['Esportes', 'Loterias', 'Consumo', 'Comsumo', 'Day Trade'],
  included: [
    {
      id: '1',
      title: 'Market outlook',
      link: 'https://example.com/market',
      publishedAt: null,
      categories: ['Mercados'],
      summary: 'Markets rose.',
    },
  ],
  excluded: [
    {
      id: '2',
      title: 'Lottery result',
      link: 'https://example.com/lottery',
      publishedAt: null,
      categories: ['Loterias'],
      summary: 'Numbers.',
      matchedCategories: ['Loterias'],
    },
  ],
  xml: '<rss><channel><title>InfoMoney</title></channel></rss>',
};

function renderPage(): void {
  render(
    <ThemeProvider>
      <NewsPage />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  window.localStorage.setItem('finance-manager:news-language', 'en');
  mocks.useNewsFeed.mockReturnValue({
    data: DATA,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('NewsPage', () => {
  it('shows the active filter and the included stories', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Active filter' })).toBeInTheDocument();
    expect(screen.getByText('Day Trade')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Included\s*\(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Excluded\s*\(1\)/ })).toBeInTheDocument();
    expect(screen.getByText('Market outlook')).toBeInTheDocument();
  });

  it('shows excluded stories and the category that removed them', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /Excluded\s*\(1\)/ }));

    expect(screen.getByText('Lottery result')).toBeInTheDocument();
    expect(screen.getByText(/Excluded by: Loterias/)).toBeInTheDocument();
  });

  it('shows the filtered XML in the XML tab', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'XML feed' }));

    expect(document.querySelector('pre')?.textContent).toContain('<rss>');
  });
});
