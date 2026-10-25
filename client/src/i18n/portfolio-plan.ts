import { getInitialBillsLanguage, type BillsLanguage } from './bills';

export type PortfolioPlanLanguage = BillsLanguage;

export function getInitialPortfolioPlanLanguage(): PortfolioPlanLanguage {
  return getInitialBillsLanguage();
}

export const portfolioPlanCopy = {
  en: {
    link: 'Investment plan notes',
    title: 'Investment plan notes',
    description: 'Keep shared notes about your investment plan.',
    addPlaceholder: 'Add a note…',
    add: 'Add note',
    adding: 'Adding…',
    edit: 'Edit note',
    save: 'Save note',
    cancel: 'Cancel',
    loading: 'Loading notes…',
    loadError: 'Unable to load notes.',
    empty: 'No plan notes yet.',
    delete: 'Delete note',
    added: 'Note added',
    updated: 'Note updated',
    deleted: 'Note deleted',
    edited: '(edited)',
    characterCount: (count: number) => `${count}/10000`,
  },
  pt: {
    link: 'Notas do plano de investimentos',
    title: 'Notas do plano de investimentos',
    description: 'Registre notas compartilhadas sobre seu plano de investimentos.',
    addPlaceholder: 'Adicione uma nota…',
    add: 'Adicionar nota',
    adding: 'Adicionando…',
    edit: 'Editar nota',
    save: 'Salvar nota',
    cancel: 'Cancelar',
    loading: 'Carregando notas…',
    loadError: 'Não foi possível carregar as notas.',
    empty: 'Ainda não há notas do plano.',
    delete: 'Excluir nota',
    added: 'Nota adicionada',
    updated: 'Nota atualizada',
    deleted: 'Nota excluída',
    edited: '(editada)',
    characterCount: (count: number) => `${count}/10000`,
  },
} as const;
