import './style.css';
import { DAY, dayStart, weekStart, formatDate, formatTime, segments } from './calendar.ts';
import { refresh, mockData, requestData, type State } from './data.ts';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const calendar = element('calendar');
const status = element('status');
const button = element<HTMLButtonElement>('refresh');
const demo = import.meta.env.DEV && new URLSearchParams(location.search).get('demo') === '1';
const endpoint = import.meta.env.VITE_AVAILABILITY_API_URL;
let state: State = { loading: false, error: false };
const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

function render() {
  const now = Date.now();
  const monday = weekStart(now);
  element('range-title').textContent = `${formatDate(monday, true)} — ${formatDate(monday + 13 * DAY, true)}`;
  element('updated').textContent = state.data ? `更新于 ${formatDate(state.data.updatedAt)} ${formatTime(state.data.updatedAt)}` : '尚未获取数据';
  button.disabled = state.loading || (!demo && !endpoint);
  button.textContent = state.loading ? '获取中…' : state.error ? '重试 ↻' : '刷新 ↻';
  status.className = state.error || (!demo && !endpoint) ? 'notice' : '';
  status.textContent = !demo && !endpoint ? '尚未配置日历接口。配置后即可查看真实忙闲时间。'
    : state.error ? state.data ? '刷新失败，仍显示上次获取的数据；请稍后重试。' : '暂时无法获取忙闲时间，请重试。'
    : state.loading ? '正在获取忙闲时间…' : '';
  status.hidden = !status.textContent;
  calendar.setAttribute('aria-busy', String(state.loading));
  const scrollPositions = [...calendar.querySelectorAll('.week-scroll')].map(el => el.scrollLeft);
  calendar.replaceChildren();
  for (let week = 0; week < 2; week++) {
    const first = monday + week * 7 * DAY;
    const section = document.createElement('section');
    section.id = `week-${week}`;
    section.className = 'week';
    section.setAttribute('aria-labelledby', `week-title-${week}`);
    section.innerHTML = `<div class="week-heading"><h3 id="week-title-${week}">${week ? '下周' : '本周'} <span>/ WEEK ${week + 1}</span></h3><span>${formatDate(first)} — ${formatDate(first + 6 * DAY)}</span></div>`;
    const scroller = document.createElement('div');
    scroller.className = 'week-scroll';
    scroller.tabIndex = 0;
    scroller.setAttribute('role', 'region');
    scroller.setAttribute('aria-label', `${week ? '下周' : '本周'}时间表`);
    const grid = document.createElement('div');
    grid.className = 'week-grid';
    const corner = document.createElement('div');
    corner.className = 'corner';
    corner.textContent = 'UTC+8';
    grid.append(corner);
    for (let i = 0; i < 7; i++) {
      const date = first + i * DAY;
      const head = document.createElement('div');
      head.className = `day-heading ${date === dayStart(now) ? 'today' : ''} ${i >= 5 ? 'weekend' : ''}`;
      head.innerHTML = `<span>周${weekdays[i]}</span><strong>${formatDate(date)}</strong>${date === dayStart(now) ? '<small>今天</small>' : ''}`;
      grid.append(head);
    }
    const axis = document.createElement('div');
    axis.className = 'axis';
    for (let i = 0; i <= 28; i++) {
      const label = document.createElement('span');
      label.textContent = `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`;
      label.style.top = `${i / 28 * 100}%`;
      if (i % 2) label.className = 'half';
      axis.append(label);
    }
    grid.append(axis);
    for (let i = 0; i < 7; i++) {
      const day = first + i * DAY;
      const column = document.createElement('div');
      column.className = 'day-column';
      column.setAttribute('aria-label', `${formatDate(day)} 周${weekdays[i]}`);
      for (const segment of segments(day, now, state.data)) {
        if (segment.kind === 'free') continue;
        const block = document.createElement('div');
        block.className = `segment ${segment.kind}`;
        block.style.top = `${(segment.start - day - 8 * 3_600_000) / (14 * 3_600_000) * 100}%`;
        block.style.height = `${(segment.end - segment.start) / (14 * 3_600_000) * 100}%`;
        if (segment.kind === 'busy') {
          block.textContent = '忙碌';
        } else {
          block.setAttribute('aria-label', segment.kind === 'past' ? '已过去' : '无数据');
          if (segment.end - segment.start > 3 * 3_600_000 && segment.kind === 'unknown') block.textContent = '无数据';
        }
        column.append(block);
      }
      grid.append(column);
    }
    scroller.append(grid);
    section.append(scroller);
    calendar.append(section);
    scroller.scrollLeft = scrollPositions[week] ?? 0;
  }
}
async function load() {
  if (state.loading || (!demo && !endpoint)) return;
  state = { ...state, loading: true };
  render();
  state = await refresh(state, () => demo ? Promise.resolve(mockData(Date.now())) : requestData(import.meta.env.DEV ? '/availability-api' : endpoint));
  render();
}
button.addEventListener('click', load);
render();
void load();
setInterval(render, 60_000);
