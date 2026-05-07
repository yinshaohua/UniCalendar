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
    this.modalEl.addClass('uni-calendar-event-detail-modal');

    // Title
    this.titleEl.setText(this.event.title);
    this.titleEl.addClass('uni-calendar-event-detail-title');

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
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
