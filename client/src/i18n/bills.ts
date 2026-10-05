export type BillsLanguage = 'en' | 'pt';

const LANGUAGE_STORAGE_KEY = 'finance-manager:bills-language';

export function getInitialBillsLanguage(): BillsLanguage {
  if (typeof window !== 'undefined') {
    try {
      const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLanguage === 'en' || savedLanguage === 'pt') return savedLanguage;
    } catch {
      // Fall back to the browser language when storage is unavailable.
    }
    const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];
    if (browserLanguages.some((language) => language.toLowerCase().startsWith('pt'))) return 'pt';
  }
  return 'en';
}

export function saveBillsLanguage(language: BillsLanguage): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Keep the in-memory selection even when the browser blocks storage.
  }
}

export const billsCopy = {
  en: {
    billsControl: 'Bills Control', investments: 'Investments', backToInvestments: 'Back to Investments',
    language: 'Language', english: 'English', portuguese: 'Portugu\u00eas (Brasil)', signOut: 'Sign out', signingOut: 'Signing out...',
    addBill: 'Add a bill', editBill: 'Edit bill', saveChanges: 'Save changes', cancel: 'Cancel',
    editDescription: 'Update the amount, allocation month, payer, bill responsibility, or payment status.', copiedValues: 'Bill values copied below. Review and edit them before adding.',
    addDescription: 'Record the amount, allocation month, payer, responsibility, and payment status.',
    amount: 'Amount (R$)', type: 'Type', selectType: 'Select type', internet: 'Internet', cleaning: 'Cleaning', condo: 'Condominium', energy: 'Energy', card: 'Card', other: 'Other',
    details: 'Details', optional: '(optional)', whatFor: 'What is this bill for?', month: 'Month', whoPaid: 'Who paid', notSpecified: 'Not specified',
    responsibility: 'Bill responsibility', splitEqually: 'Split equally', henriqueFull: 'Henrique pays the full bill', amandaFull: 'Amanda pays the full bill',
    responsibilityError: 'For a full responsibility bill, select a payer and choose a different responsible person, or select Split equally.',
    billIsPaid: 'Bill is paid', addBillButton: 'Add bill', bills: 'Bills', billRecorded: 'bill recorded', billsRecorded: 'bills recorded', retry: 'Retry',
    loadingBills: 'Loading bills...', loadError: 'Unable to load bills. The server may be unavailable.', noBills: 'No bills yet', billsWillAppear: 'Bills you add will appear here.',
    monthlyTotal: 'Monthly bill total', paidByHenrique: 'Paid by Henrique', paidByAmanda: 'Paid by Amanda', settlement: 'Settlement for paid bills',
    noPaymentDue: 'No payment is due for this month.', settlementPaid: 'Settlement paid',
    settlementDescription: 'Monthly total includes unpaid bills. Settlement uses only paid bills with a payer selected, combining equal splits with bills assigned to one person.',
    payerMissing: 'in paid bills has no payer selected and is excluded from settlement.', typeLabel: 'Type:', paidByLabel: 'Paid by:', responsibilityLabel: 'Responsibility:', detailsLabel: 'Details:',
    replicate: 'Replicate', edit: 'Edit', delete: 'Delete', monthColumn: 'Month', amountColumn: 'Amount', typeColumn: 'Type', paidByColumn: 'Paid by',
    responsibilityColumn: 'Responsibility', statusColumn: 'Status', actionsColumn: 'Actions', paid: 'Paid', unpaid: 'Unpaid',
    fullBill: 'pays the full bill', duplicateTitle: 'This bill type already exists this month', duplicateCancel: 'Cancel', adding: 'Adding...', addAnyway: 'Add anyway',
    duplicateMessage: (type: string, month: string) => `${type} already has a bill for ${month}. Do you want to add another anyway?`,
    deleteTitle: 'Delete this bill?', deleteDescription: (amount: string, month: string) => `${amount} from ${month} will be permanently deleted.`,
    deleting: 'Deleting...', deleteBill: 'Delete bill', billDeleted: 'Bill deleted', deleteError: 'Unable to delete this bill.',
    settlementError: 'Unable to update settlement status.', saveError: 'Unable to save this bill.', updateError: 'Unable to update this bill.',
    payerNames: { HENRIQUE: 'Henrique', AMANDA: 'Amanda' }, typeNames: { INTERNET: 'Internet', CLEANING: 'Cleaning', CONDOMINIO: 'Condominium', ENERGY: 'Energy', CARD: 'Card', OTHER: 'Other' },
  },
  pt: {
    billsControl: 'Controle de contas', investments: 'Investimentos', backToInvestments: 'Voltar para investimentos',
    language: 'Idioma', english: 'English', portuguese: 'Portugu\u00eas (Brasil)', signOut: 'Sair', signingOut: 'Saindo...',
    addBill: 'Adicionar conta', editBill: 'Editar conta', saveChanges: 'Salvar altera\u00e7\u00f5es', cancel: 'Cancelar',
    editDescription: 'Atualize o valor, o m\u00eas de refer\u00eancia, o pagador, a responsabilidade ou o status do pagamento.', copiedValues: 'Os dados da conta foram copiados abaixo. Revise e edite antes de adicionar.',
    addDescription: 'Informe o valor, o m\u00eas de refer\u00eancia, quem pagou, a responsabilidade e o status do pagamento.',
    amount: 'Valor (R$)', type: 'Tipo', selectType: 'Selecione o tipo', internet: 'Internet', cleaning: 'Faxina', condo: 'Condom\u00ednio', energy: 'Energia', card: 'Cart\u00e3o', other: 'Outro',
    details: 'Detalhes', optional: '(opcional)', whatFor: 'Do que se trata esta conta?', month: 'M\u00eas', whoPaid: 'Quem pagou', notSpecified: 'N\u00e3o informado',
    responsibility: 'Responsabilidade pela conta', splitEqually: 'Dividir igualmente', henriqueFull: 'Henrique paga o valor integral', amandaFull: 'Amanda paga o valor integral',
    responsibilityError: 'Para atribuir a responsabilidade integral, informe quem pagou e selecione outra pessoa como respons\u00e1vel, ou escolha Dividir igualmente.',
    billIsPaid: 'Conta paga', addBillButton: 'Adicionar conta', bills: 'Contas', billRecorded: 'conta registrada', billsRecorded: 'contas registradas', retry: 'Tentar novamente',
    loadingBills: 'Carregando contas...', loadError: 'N\u00e3o foi poss\u00edvel carregar as contas. O servidor pode estar indispon\u00edvel.', noBills: 'Nenhuma conta ainda', billsWillAppear: 'As contas adicionadas aparecer\u00e3o aqui.',
    monthlyTotal: 'Total de contas do m\u00eas', paidByHenrique: 'Pago por Henrique', paidByAmanda: 'Pago por Amanda', settlement: 'Acerto das contas pagas',
    noPaymentDue: 'N\u00e3o h\u00e1 valores a acertar neste m\u00eas.', settlementPaid: 'Acerto pago',
    settlementDescription: 'O total mensal inclui contas n\u00e3o pagas. O acerto considera apenas contas pagas com pagador informado, combinando divis\u00f5es iguais e contas atribu\u00eddas a uma pessoa.',
    payerMissing: 'em contas pagas sem pagador informado n\u00e3o entra no acerto.', typeLabel: 'Tipo:', paidByLabel: 'Pago por:', responsibilityLabel: 'Responsabilidade:', detailsLabel: 'Detalhes:',
    replicate: 'Duplicar', edit: 'Editar', delete: 'Excluir', monthColumn: 'M\u00eas', amountColumn: 'Valor', typeColumn: 'Tipo', paidByColumn: 'Pago por',
    responsibilityColumn: 'Responsabilidade', statusColumn: 'Status', actionsColumn: 'A\u00e7\u00f5es', paid: 'Pago', unpaid: 'Pendente',
    fullBill: 'paga o valor integral', duplicateTitle: 'J\u00e1 existe uma conta deste tipo neste m\u00eas', duplicateCancel: 'Cancelar', adding: 'Adicionando...', addAnyway: 'Adicionar mesmo assim',
    duplicateMessage: (type: string, month: string) => `${type} j\u00e1 tem uma conta em ${month}. Deseja adicionar outra mesmo assim?`,
    deleteTitle: 'Excluir esta conta?', deleteDescription: (amount: string, month: string) => `${amount} referente a ${month} ser\u00e1 exclu\u00eddo permanentemente.`,
    deleting: 'Excluindo...', deleteBill: 'Excluir conta', billDeleted: 'Conta exclu\u00edda', deleteError: 'N\u00e3o foi poss\u00edvel excluir esta conta.',
    settlementError: 'N\u00e3o foi poss\u00edvel atualizar o status do acerto.', saveError: 'N\u00e3o foi poss\u00edvel salvar esta conta.', updateError: 'N\u00e3o foi poss\u00edvel atualizar esta conta.',
    payerNames: { HENRIQUE: 'Henrique', AMANDA: 'Amanda' }, typeNames: { INTERNET: 'Internet', CLEANING: 'Faxina', CONDOMINIO: 'Condom\u00ednio', ENERGY: 'Energia', CARD: 'Cart\u00e3o', OTHER: 'Outro' },
  },
} as const;
