import { App, Modal, setIcon } from 'obsidian';
import { CalendarEvent, CalendarSource } from '../models/types';

export class EventDetailModal extends Modal {
  private event: CalendarEvent;
  private sources: CalendarSource[];

  constructor(app: App, event: CalendarEvent, sources: CalendarSource[]) {
    super(app);
    this.event = event;
    this.sources = sources;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('uni-calendar-event-detail');
    this.modalEl.style.boxShadow = '0 8px 32px rgba(0,0,0,0.18)';

    // Title
    this.titleEl.setText(this.event.title);
    this.titleEl.style.fontWeight = '600';
    this.titleEl.style.fontSize = 'var(--font-ui-medium)';
    this.titleEl.style.marginBottom = '16px';

    // Time field
    const timeRow = contentEl.createDiv({ cls: 'uni-calendar-detail-row' });
    const timeIcon = timeRow.createSpan({ cls: 'uni-calendar-detail-icon' });
    setIcon(timeIcon, 'clock');
    const start = new Date(this.event.start);
    const end = new Date(this.event.end);
    let timeText: string;
    if (this.event.allDay) {
      const dateFmt = (d: Date) => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
      timeText = start.toDateString() === end.toDateString()
        ? `${dateFmt(start)} 全天`
        : `${dateFmt(start)} - ${dateFmt(end)} 全天`;
    } else {
      const dateFmt = (d: Date) => {
        const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return `${d.getMonth() + 1}月${d.getDate()}日 ${dayNames[d.getDay()]}`;
      };
      const timeFmt = (d: Date) => d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
      if (start.toDateString() === end.toDateString()) {
        timeText = `${dateFmt(start)} ${timeFmt(start)}-${timeFmt(end)}`;
      } else {
        timeText = `${dateFmt(start)} ${timeFmt(start)} - ${dateFmt(end)} ${timeFmt(end)}`;
      }
    }
    timeRow.createSpan({ text: timeText, cls: 'uni-calendar-detail-text' });

    // Location field (only if present, per D-07)
    if (this.event.location) {
      const locRow = contentEl.createDiv({ cls: 'uni-calendar-detail-row' });
      const locIcon = locRow.createSpan({ cls: 'uni-calendar-detail-icon' });
      setIcon(locIcon, 'map-pin');
      locRow.createSpan({ text: this.event.location, cls: 'uni-calendar-detail-text' });
    }

    // Description field (only if present, per D-07)
    if (this.event.description) {
      const descRow = contentEl.createDiv({ cls: 'uni-calendar-detail-row' });
      const descIcon = descRow.createSpan({ cls: 'uni-calendar-detail-icon' });
      setIcon(descIcon, 'align-left');
      const descText = descRow.createDiv({ cls: 'uni-calendar-detail-desc' });
      descText.setText(this.event.description);
    }

    // Source field
    const source = this.sources.find(s => s.id === this.event.sourceId);
    if (source) {
      const srcRow = contentEl.createDiv({ cls: 'uni-calendar-detail-row' });
      srcRow.createSpan({
        cls: 'uni-calendar-detail-color-dot',
        attr: { style: `background: ${source.color}` },
      });
      srcRow.createSpan({ text: source.name, cls: 'uni-calendar-detail-text' });
    }

    // Inject styles
    contentEl.createEl('style', { text: `
      .uni-calendar-detail-row {
        display: flex;
        align-items: flex-start;
        margin-bottom: 14px;
        font-size: var(--font-ui-small);
        color: var(--text-normal);
      }
      .uni-calendar-detail-icon {
        flex-shrink: 0;
        color: var(--text-muted);
        margin-right: 8px;
        margin-top: 1px;
        display: flex;
        align-items: center;
      }
      .uni-calendar-detail-icon svg {
        width: 16px;
        height: 16px;
      }
      .uni-calendar-detail-text {
        font-weight: 400;
      }
      .uni-calendar-detail-desc {
        white-space: pre-wrap;
        max-height: 200px;
        overflow-y: auto;
        font-weight: 400;
      }
      .uni-calendar-detail-color-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex-shrink: 0;
        margin-right: 8px;
        margin-top: 3px;
      }
      .uni-calendar-event-detail {
        animation: uni-fade-in 0.2s ease;
      }
      @keyframes uni-fade-in {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `});
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
