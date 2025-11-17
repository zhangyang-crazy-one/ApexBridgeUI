
export class CustomModal {
  private modalElement: HTMLElement | null = null;

  public show({
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Confirm',
    cancelText = 'Cancel'
  }: {
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  }): void {
    this.createModal({ title, message, confirmText, cancelText });
    if (!this.modalElement) return;

    const confirmButton = this.modalElement.querySelector('.modal-confirm-btn');
    const cancelButton = this.modalElement.querySelector('.modal-cancel-btn');
    const closeButton = this.modalElement.querySelector('.modal-close-btn');

    const handleConfirm = () => {
      onConfirm();
      this.hide();
    };

    const handleCancel = () => {
      if (onCancel) {
        onCancel();
      }
      this.hide();
    };

    confirmButton?.addEventListener('click', handleConfirm);
    cancelButton?.addEventListener('click', handleCancel);
    closeButton?.addEventListener('click', handleCancel);

    document.body.appendChild(this.modalElement);
    // Trigger fade-in animation
    setTimeout(() => this.modalElement?.classList.add('visible'), 10);
  }

  public hide(): void {
    if (!this.modalElement) return;
    this.modalElement.classList.remove('visible');
    // Wait for animation to finish before removing
    this.modalElement.addEventListener('transitionend', () => {
      this.modalElement?.remove();
      this.modalElement = null;
    });
  }

  private createModal({
    title,
    message,
    confirmText,
    cancelText
  }: {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
  }): void {
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'custom-modal-overlay';
    this.modalElement.innerHTML = `
      <div class="custom-modal">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <p>${message}</p>
        </div>
        <div class="modal-footer">
          <button class="modal-btn modal-cancel-btn">${cancelText}</button>
          <button class="modal-btn modal-confirm-btn">${confirmText}</button>
        </div>
      </div>
    `;
  }
}

/**
 * Show a custom confirm dialog and return a Promise
 * @param options - Dialog configuration
 * @returns Promise that resolves to true if confirmed, false if cancelled
 */
export function showCustomConfirm(options: {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = new CustomModal();
    modal.show({
      title: options.title,
      message: options.message,
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false)
    });
  });
}
