/**
 * MigrationWizard Component (US5-028)
 *
 * Guides users through the data migration process:
 * - Check migration status
 * - Display Electron data location
 * - Confirm backup creation
 * - Show migration progress
 * - Display completion status
 */

import { invoke } from '@tauri-apps/api/core';
import { t } from '../core/i18n/i18nHelper';

interface MigrationStatus {
  is_migrated: boolean;
  electron_path: string | null;
  tauri_path: string;
  backup_path: string | null;
  migration_date: string | null;
}

type WizardStep = 'check' | 'confirm' | 'progress' | 'complete' | 'error';

export class MigrationWizard {
  private container: HTMLElement;
  private currentStep: WizardStep = 'check';
  private migrationStatus: MigrationStatus | null = null;
  private errorMessage: string | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.init();
  }

  /**
   * Initialize the wizard
   */
  private async init(): Promise<void> {
    await this.checkMigrationStatus();
    this.render();
  }

  /**
   * Check current migration status
   */
  private async checkMigrationStatus(): Promise<void> {
    try {
      this.migrationStatus = await invoke<MigrationStatus>('check_migration_status');
    } catch (error) {
      console.error('Failed to check migration status:', error);
      this.errorMessage = (error as Error).message;
      this.currentStep = 'error';
    }
  }

  /**
   * Render the wizard
   */
  private render(): void {
    this.container.innerHTML = `
      <div class="migration-wizard">
        ${this.renderHeader()}
        ${this.renderStep()}
        ${this.renderActions()}
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render wizard header
   */
  private renderHeader(): string {
    return `
      <div class="wizard-header">
        <div class="wizard-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h2>${t('migration.title')}</h2>
        <p class="wizard-subtitle">${t('migration.subtitle')}</p>
      </div>

      <div class="wizard-progress">
        <div class="progress-step ${this.currentStep === 'check' || this.currentStep === 'error' ? 'active' : 'complete'}">
          <div class="progress-dot"></div>
          <span>${t('migration.step.check')}</span>
        </div>
        <div class="progress-line ${this.currentStep === 'confirm' || this.currentStep === 'progress' || this.currentStep === 'complete' ? 'active' : ''}"></div>
        <div class="progress-step ${this.currentStep === 'confirm' ? 'active' : this.currentStep === 'progress' || this.currentStep === 'complete' ? 'complete' : ''}">
          <div class="progress-dot"></div>
          <span>${t('migration.step.confirm')}</span>
        </div>
        <div class="progress-line ${this.currentStep === 'progress' || this.currentStep === 'complete' ? 'active' : ''}"></div>
        <div class="progress-step ${this.currentStep === 'progress' ? 'active' : this.currentStep === 'complete' ? 'complete' : ''}">
          <div class="progress-dot"></div>
          <span>${t('migration.step.migrate')}</span>
        </div>
        <div class="progress-line ${this.currentStep === 'complete' ? 'active' : ''}"></div>
        <div class="progress-step ${this.currentStep === 'complete' ? 'complete' : ''}">
          <div class="progress-dot"></div>
          <span>${t('migration.step.complete')}</span>
        </div>
      </div>
    `;
  }

  /**
   * Render current step content
   */
  private renderStep(): string {
    switch (this.currentStep) {
      case 'check':
        return this.renderCheckStep();
      case 'confirm':
        return this.renderConfirmStep();
      case 'progress':
        return this.renderProgressStep();
      case 'complete':
        return this.renderCompleteStep();
      case 'error':
        return this.renderErrorStep();
      default:
        return '';
    }
  }

  /**
   * Render check step
   */
  private renderCheckStep(): string {
    if (!this.migrationStatus) {
      return `
        <div class="wizard-step">
          <div class="spinner"></div>
          <p>${t('migration.checking')}</p>
        </div>
      `;
    }

    if (this.migrationStatus.is_migrated) {
      return `
        <div class="wizard-step">
          <div class="alert alert-success">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="22 4 12 14.01 9 11.01" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div>
              <h4>${t('migration.alreadyMigrated.title')}</h4>
              <p>${t('migration.alreadyMigrated.message')}</p>
              <div class="migration-info">
                <p><strong>${t('migration.date')}:</strong> ${this.formatDate(this.migrationStatus.migration_date!)}</p>
                <p><strong>${t('migration.backupPath')}:</strong> ${this.migrationStatus.backup_path}</p>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (!this.migrationStatus.electron_path) {
      return `
        <div class="wizard-step">
          <div class="alert alert-info">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" stroke-width="2"/>
              <line x1="12" y1="8" x2="12" y2="12" stroke-width="2" stroke-linecap="round"/>
              <line x1="12" y1="16" x2="12.01" y2="16" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <div>
              <h4>${t('migration.noData.title')}</h4>
              <p>${t('migration.noData.message')}</p>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="wizard-step">
        <div class="alert alert-warning">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="12" y1="9" x2="12" y2="13" stroke-width="2" stroke-linecap="round"/>
            <line x1="12" y1="17" x2="12.01" y2="17" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <div>
            <h4>${t('migration.found.title')}</h4>
            <p>${t('migration.found.message')}</p>
            <div class="migration-info">
              <p><strong>${t('migration.electronPath')}:</strong> ${this.migrationStatus.electron_path}</p>
              <p><strong>${t('migration.tauriPath')}:</strong> ${this.migrationStatus.tauri_path}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render confirm step
   */
  private renderConfirmStep(): string {
    return `
      <div class="wizard-step">
        <h3>${t('migration.confirm.title')}</h3>
        <p>${t('migration.confirm.message')}</p>

        <div class="migration-details">
          <div class="detail-row">
            <span class="detail-label">${t('migration.source')}:</span>
            <span class="detail-value">${this.migrationStatus?.electron_path}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${t('migration.destination')}:</span>
            <span class="detail-value">${this.migrationStatus?.tauri_path}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${t('migration.backup')}:</span>
            <span class="detail-value">${this.migrationStatus?.electron_path?.replace('AppData', 'VCPChat_backup')}</span>
          </div>
        </div>

        <div class="alert alert-info">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" stroke-width="2"/>
            <line x1="12" y1="8" x2="12" y2="12" stroke-width="2" stroke-linecap="round"/>
            <line x1="12" y1="16" x2="12.01" y2="16" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <div>
            <p>${t('migration.confirm.backup')}</p>
            <p>${t('migration.confirm.nonDestructive')}</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render progress step
   */
  private renderProgressStep(): string {
    return `
      <div class="wizard-step">
        <h3>${t('migration.progress.title')}</h3>
        <p>${t('migration.progress.message')}</p>

        <div class="migration-progress-bar">
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: 0%" data-progress-bar></div>
          </div>
          <div class="progress-text" data-progress-text>0%</div>
        </div>

        <div class="progress-log" data-progress-log>
          <p>${t('migration.progress.starting')}</p>
        </div>
      </div>
    `;
  }

  /**
   * Render complete step
   */
  private renderCompleteStep(): string {
    return `
      <div class="wizard-step">
        <div class="alert alert-success">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="22 4 12 14.01 9 11.01" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div>
            <h3>${t('migration.complete.title')}</h3>
            <p>${t('migration.complete.message')}</p>
            <div class="migration-info">
              <p><strong>${t('migration.complete.restart')}</strong></p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render error step
   */
  private renderErrorStep(): string {
    return `
      <div class="wizard-step">
        <div class="alert alert-error">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" stroke-width="2"/>
            <line x1="15" y1="9" x2="9" y2="15" stroke-width="2" stroke-linecap="round"/>
            <line x1="9" y1="9" x2="15" y2="15" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <div>
            <h4>${t('migration.error.title')}</h4>
            <p>${this.errorMessage || t('migration.error.unknown')}</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render action buttons
   */
  private renderActions(): string {
    if (this.migrationStatus?.is_migrated) {
      return `
        <div class="wizard-actions">
          <button type="button" class="btn-primary" data-action="close">
            ${t('common.close')}
          </button>
        </div>
      `;
    }

    if (!this.migrationStatus?.electron_path) {
      return `
        <div class="wizard-actions">
          <button type="button" class="btn-primary" data-action="close">
            ${t('common.close')}
          </button>
        </div>
      `;
    }

    switch (this.currentStep) {
      case 'check':
        return `
          <div class="wizard-actions">
            <button type="button" class="btn-secondary" data-action="close">
              ${t('common.cancel')}
            </button>
            <button type="button" class="btn-primary" data-action="next">
              ${t('migration.startMigration')}
            </button>
          </div>
        `;

      case 'confirm':
        return `
          <div class="wizard-actions">
            <button type="button" class="btn-secondary" data-action="back">
              ${t('common.back')}
            </button>
            <button type="button" class="btn-primary" data-action="migrate">
              ${t('migration.confirm.button')}
            </button>
          </div>
        `;

      case 'progress':
        return '';

      case 'complete':
        return `
          <div class="wizard-actions">
            <button type="button" class="btn-primary" data-action="restart">
              ${t('migration.restartApp')}
            </button>
          </div>
        `;

      case 'error':
        return `
          <div class="wizard-actions">
            <button type="button" class="btn-secondary" data-action="close">
              ${t('common.close')}
            </button>
            <button type="button" class="btn-primary" data-action="retry">
              ${t('common.retry')}
            </button>
          </div>
        `;

      default:
        return '';
    }
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Next button (check → confirm)
    const nextBtn = this.container.querySelector('[data-action="next"]');
    nextBtn?.addEventListener('click', () => {
      this.currentStep = 'confirm';
      this.render();
    });

    // Back button (confirm → check)
    const backBtn = this.container.querySelector('[data-action="back"]');
    backBtn?.addEventListener('click', () => {
      this.currentStep = 'check';
      this.render();
    });

    // Migrate button (confirm → progress)
    const migrateBtn = this.container.querySelector('[data-action="migrate"]');
    migrateBtn?.addEventListener('click', () => this.startMigration());

    // Restart button
    const restartBtn = this.container.querySelector('[data-action="restart"]');
    restartBtn?.addEventListener('click', () => this.restartApp());

    // Retry button
    const retryBtn = this.container.querySelector('[data-action="retry"]');
    retryBtn?.addEventListener('click', () => {
      this.currentStep = 'check';
      this.errorMessage = null;
      this.init();
    });

    // Close button
    const closeBtn = this.container.querySelector('[data-action="close"]');
    closeBtn?.addEventListener('click', () => this.close());
  }

  /**
   * Start migration process
   */
  private async startMigration(): Promise<void> {
    this.currentStep = 'progress';
    this.render();

    try {
      // Execute migration
      const result = await invoke<string>('migrate_from_electron');

      console.log('Migration result:', result);

      this.currentStep = 'complete';
      this.render();
    } catch (error) {
      console.error('Migration failed:', error);
      this.errorMessage = (error as Error).message;
      this.currentStep = 'error';
      this.render();
    }
  }

  /**
   * Restart application
   */
  private async restartApp(): Promise<void> {
    const { relaunch, exit } = await import('@tauri-apps/api/process');
    await relaunch();
    await exit(0);
  }

  /**
   * Close wizard
   */
  private close(): void {
    this.container.innerHTML = '';
  }

  /**
   * Format date
   */
  private formatDate(isoDate: string): string {
    const date = new Date(isoDate);
    return date.toLocaleString();
  }
}
