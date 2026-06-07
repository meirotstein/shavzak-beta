import { useEffect, useMemo, useRef, useState } from 'react';
import { buildDateRange, formatShortDate, getDaysBetween, isSameMonth, isToday } from './domain/dates';
import {
  countDelta,
  createDailyPresence,
  DEFAULT_CATEGORY,
  getPresenceCategory,
  HOME_CATEGORY,
  homeDelta,
  nextPresenceValue,
  normalizePresence,
  parseSoldierDescription,
  profileForSoldier,
} from './domain/presence';
import { CategorySummary, CompanyData, PresenceValue, SelectedSoldier } from './domain/types';
import {
  GOOGLE_LOGIN_HINT_STORAGE_KEY,
  GOOGLE_SIGNED_IN_STORAGE_KEY,
  SPREADSHEET_STORAGE_KEY,
} from './services/config';
import { GoogleAuthService } from './services/googleAuth';
import { SpreadsheetRepository } from './services/spreadsheetRepository';
import logoUrl from './assets/logo-8208.png';

type ViewState = 'booting' | 'signed-out' | 'ready' | 'loading' | 'loaded' | 'error';

const auth = new GoogleAuthService();

function appLog(message: string, details?: unknown): void {
  if (details === undefined) {
    console.log(`[app-auth] ${message}`);
  } else {
    console.log(`[app-auth] ${message}`, details);
  }
}

function spreadsheetIdFromLocation(): string {
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get('spid');
  if (fromUrl) {
    localStorage.setItem(SPREADSHEET_STORAGE_KEY, fromUrl);
    return fromUrl;
  }
  return '';
}

function categoriesByName(categories: CategorySummary[]): Record<string, number[]> {
  return Object.fromEntries(categories.map((category) => [category.name, [...category.sums]]));
}

function monthLabel(month: number, year: number): string {
  return new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
}

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromInput(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function statusLabel(value: PresenceValue): string {
  if (value === '1') return 'נוכח';
  if (value === '0') return 'חופשה';
  if (value === '2') return 'מחלה';
  if (value === '3') return 'התארגנות';
  return 'לא סומן';
}

export function App() {
  const [view, setView] = useState<ViewState>('booting');
  const [error, setError] = useState('');
  const [spreadsheetId] = useState(spreadsheetIdFromLocation);
  const [data, setData] = useState<CompanyData | null>(null);
  const [categorySums, setCategorySums] = useState<Record<string, number[]>>({});
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORY);
  const [selectedSoldier, setSelectedSoldier] = useState<SelectedSoldier | null>(null);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [savingDays, setSavingDays] = useState<Set<number>>(() => new Set());
  const [failedDays, setFailedDays] = useState<Set<number>>(() => new Set());
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentFailed, setCommentFailed] = useState(false);
  const [dailyDate, setDailyDate] = useState<Date | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());

  const repo = useMemo(() => (spreadsheetId ? new SpreadsheetRepository(spreadsheetId) : null), [spreadsheetId]);
  const dates = useMemo(
    () => (data ? buildDateRange(data.startDate, data.endDate) : []),
    [data?.startDate, data?.endDate],
  );

  const filteredSoldiers = useMemo(() => {
    if (!data || !searchFocused || !query.trim()) return [];
    return data.presenceRows.filter((soldier) => soldier.description.includes(query.trim())).slice(0, 30);
  }, [data, query, searchFocused]);

  const visibleDates = useMemo(
    () => dates.map((date, index) => ({ date, index })).filter(({ date }) => isSameMonth(date, calendarMonth, calendarYear)),
    [calendarMonth, calendarYear, dates],
  );

  const currentProfile = selectedSoldier && data ? selectedSoldier.profile || profileForSoldier(data, selectedSoldier) : undefined;
  const isReadOnly = Boolean(data?.meta.isReadOnly);

  useEffect(() => {
    let cancelled = false;

    appLog('auth effect start', {
      spreadsheetId: Boolean(spreadsheetId),
      signedInMarker: localStorage.getItem(GOOGLE_SIGNED_IN_STORAGE_KEY),
      hasLoginHint: Boolean(localStorage.getItem(GOOGLE_LOGIN_HINT_STORAGE_KEY)),
    });

    auth
      .init()
      .then(async () => {
        if (cancelled) return;
        appLog('auth init resolved', {
          signedInMarker: localStorage.getItem(GOOGLE_SIGNED_IN_STORAGE_KEY),
          hasLoginHint: Boolean(localStorage.getItem(GOOGLE_LOGIN_HINT_STORAGE_KEY)),
          authSession: auth.isSignedIn(),
        });
        if (auth.isSignedIn() || localStorage.getItem(GOOGLE_SIGNED_IN_STORAGE_KEY) === 'true') {
          try {
            appLog('attempting auth2 session restore');
            setView('loading');
            await auth.restoreSession();
            if (cancelled) return;
            localStorage.setItem(GOOGLE_SIGNED_IN_STORAGE_KEY, 'true');
            appLog('auth2 session restore succeeded');
            setView('ready');
            if (spreadsheetId) {
              appLog('auto-loading saved spreadsheet');
              await loadSpreadsheet(spreadsheetId);
            }
            return;
          } catch (silentError) {
            if (cancelled) return;
            appLog('auth2 session restore failed', silentError);
            setError('נדרש חיבור מחדש ל-Google');
          }
        }

        appLog('showing signed-out view');
        setView('signed-out');
      })
      .catch((initError) => {
        appLog('auth init failed', initError);
        setError('שגיאה בטעינת Google');
        setView('error');
      });
    return () => {
      appLog('auth effect cancelled');
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dates.length) return;
    const today = new Date();
    const initial = dates.some((date) => isSameMonth(date, today.getMonth(), today.getFullYear())) ? today : dates[0];
    setCalendarMonth(initial.getMonth());
    setCalendarYear(initial.getFullYear());
  }, [dates]);

  async function signIn() {
    try {
      appLog('manual sign-in start', {
        hasLoginHint: Boolean(localStorage.getItem(GOOGLE_LOGIN_HINT_STORAGE_KEY)),
      });
      setView('loading');
      await auth.requestAccessToken('consent', localStorage.getItem(GOOGLE_LOGIN_HINT_STORAGE_KEY) || '');
      localStorage.setItem(GOOGLE_SIGNED_IN_STORAGE_KEY, 'true');
      appLog('manual sign-in succeeded; marker stored');
      setView('ready');
      if (spreadsheetId) {
        appLog('loading spreadsheet after manual sign-in');
        await loadSpreadsheet(spreadsheetId);
      }
    } catch (manualError) {
      appLog('manual sign-in failed', manualError);
      setError('ההתחברות ל-Google נכשלה');
      setView('signed-out');
    }
  }

  function signOut() {
    appLog('manual sign-out');
    auth.signOut();
    localStorage.removeItem(GOOGLE_SIGNED_IN_STORAGE_KEY);
    localStorage.removeItem(GOOGLE_LOGIN_HINT_STORAGE_KEY);
    setData(null);
    setSelectedSoldier(null);
    setView('signed-out');
  }

  async function loadSpreadsheet(id = spreadsheetId) {
    if (!id.trim() || !repo) {
      setError('יש להזין מזהה spreadsheet');
      setView('ready');
      return;
    }

    try {
      appLog('load spreadsheet start', { hasId: Boolean(id.trim()) });
      setView('loading');
      localStorage.setItem(SPREADSHEET_STORAGE_KEY, id.trim());
      const loaded = await new SpreadsheetRepository(id.trim()).loadCompanyData();
      if (loaded.meta.userEmail) {
        localStorage.setItem(GOOGLE_LOGIN_HINT_STORAGE_KEY, loaded.meta.userEmail);
        appLog('stored login hint from spreadsheet metadata', { userEmail: loaded.meta.userEmail });
      } else {
        appLog('no user email returned for login hint');
      }
      setData(loaded);
      setCategorySums(categoriesByName(loaded.categories));
      setSelectedCategory(DEFAULT_CATEGORY);
      setSelectedSoldier(null);
      setQuery('');
      setError('');
      setView('loaded');
      appLog('load spreadsheet succeeded', {
        title: loaded.meta.title,
        isReadOnly: loaded.meta.isReadOnly,
        soldiers: loaded.presenceRows.length,
      });
    } catch (loadError) {
      appLog('load spreadsheet failed', loadError);
      const message = loadError instanceof Error && loadError.message === 'no_names_error'
        ? 'שגיאה: רשימת החיילים ריקה'
        : 'שגיאה: אין גישה לקובץ או שהקובץ אינו קיים';
      setError(message);
      setView('error');
    }
  }

  function selectSoldier(row: number) {
    if (!data) return;
    const soldier = data.presenceRows.find((item) => item.row === row);
    if (!soldier) return;
    const selection: SelectedSoldier = { ...soldier, presence: [...soldier.presence] };
    selection.profile = profileForSoldier(data, selection);
    while (selection.presence.length < dates.length) selection.presence.push('');
    setSelectedSoldier(selection);
    setQuery(selection.description);
    setSearchFocused(false);
    setDetailsOpen(false);
    setFailedDays(new Set());
  }

  async function savePresence(dayIndex: number, requestedValue?: PresenceValue) {
    if (!data || !repo || !selectedSoldier || isReadOnly) return;

    const oldValue = normalizePresence(selectedSoldier.presence[dayIndex]);
    const newValue = requestedValue ?? nextPresenceValue(oldValue);
    const category = getPresenceCategory(selectedSoldier.description);

    setSelectedSoldier({
      ...selectedSoldier,
      presence: selectedSoldier.presence.map((value, idx) => (idx === dayIndex ? newValue : value)),
    });
    setSavingDays((current) => new Set(current).add(dayIndex));
    setFailedDays((current) => {
      const next = new Set(current);
      next.delete(dayIndex);
      return next;
    });

    try {
      await repo.setPresence(data.settings, selectedSoldier.row, dayIndex, newValue);
      setData({
        ...data,
        presenceRows: data.presenceRows.map((soldier) =>
          soldier.row === selectedSoldier.row
            ? { ...soldier, presence: soldier.presence.map((value, idx) => (idx === dayIndex ? newValue : value)) }
            : soldier,
        ),
      });
      applyLocalCategoryChange(dayIndex, category, countDelta(oldValue, newValue), homeDelta(oldValue, newValue));
    } catch {
      setFailedDays((current) => new Set(current).add(dayIndex));
      setError('שמירת הנוכחות נכשלה');
    } finally {
      setSavingDays((current) => {
        const next = new Set(current);
        next.delete(dayIndex);
        return next;
      });
    }
  }

  function applyLocalCategoryChange(dayIndex: number, category: string | undefined, presentDelta: number, vacationDelta: number) {
    setCategorySums((current) => {
      const next = { ...current };
      const update = (name: string | undefined, delta: number) => {
        if (!name || !next[name] || delta === 0) return;
        next[name] = next[name].map((value, idx) => (idx === dayIndex ? value + delta : value));
      };
      update(category, presentDelta);
      update(DEFAULT_CATEGORY, presentDelta);
      update(HOME_CATEGORY, vacationDelta);
      return next;
    });
  }

  async function saveComment(value: string) {
    if (!repo || !currentProfile || !selectedSoldier || isReadOnly) return;

    setCommentSaving(true);
    setCommentFailed(false);
    try {
      await repo.setComment(currentProfile.row, value);
      const updatedProfile = { ...currentProfile, comment: value };
      setSelectedSoldier({ ...selectedSoldier, profile: updatedProfile });
      if (data) {
        setData({
          ...data,
          soldiers: data.soldiers.map((soldier) => (soldier.row === updatedProfile.row ? updatedProfile : soldier)),
        });
      }
    } catch {
      setCommentFailed(true);
      setError('שמירת ההערה נכשלה');
    } finally {
      setCommentSaving(false);
    }
  }

  function moveMonth(delta: number) {
    const next = new Date(calendarYear, calendarMonth + delta, 1);
    setCalendarMonth(next.getMonth());
    setCalendarYear(next.getFullYear());
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-title">
          <h1>שבצק</h1>
          {data && (
            <p>
              {data.meta.title}
              {data.meta.isReadOnly ? ' [צפיה בלבד]' : ''}
            </p>
          )}
        </div>
        <img src={logoUrl} alt="" className="brand-logo" />
        {view !== 'booting' && view !== 'signed-out' && (
          <div className="topbar-actions">
            <button className="ghost-button" type="button" onClick={signOut}>
              יציאה
            </button>
          </div>
        )}
      </header>

      {view === 'booting' && <SkeletonLoader />}

      {view === 'signed-out' && (
        <section className="auth-panel">
          <button className="primary-button" type="button" onClick={signIn}>
            כניסה עם Google
          </button>
        </section>
      )}

      {view === 'loading' && <SkeletonLoader />}
      {error && <div className="error-banner">{error}</div>}

      {data && view === 'loaded' && (
        <section className="workspace">
          <div className="search-zone">
            <input
              className="search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => {
                setQuery('');
                setSearchFocused(true);
                setDetailsOpen(false);
              }}
              placeholder="חפש שם"
            />
            {searchFocused && filteredSoldiers.length > 0 && (
              <ul className="result-list">
                {filteredSoldiers.map((soldier) => (
                  <li key={soldier.row}>
                    <button type="button" onClick={() => selectSoldier(soldier.row)}>
                      {soldier.description}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Calendar
            dates={visibleDates}
            selectedSoldier={selectedSoldier}
            sums={categorySums[selectedCategory] || []}
            missionTarget={data.missionCounts[selectedCategory]}
            savingDays={savingDays}
            failedDays={failedDays}
            monthLabel={monthLabel(calendarMonth, calendarYear)}
            canGoPrev={dates.some((date) => date < new Date(calendarYear, calendarMonth, 1))}
            canGoNext={dates.some((date) => date > new Date(calendarYear, calendarMonth + 1, 0))}
            readOnly={isReadOnly}
            onPrev={() => moveMonth(-1)}
            onNext={() => moveMonth(1)}
            onChange={(dayIndex, value) => void savePresence(dayIndex, value)}
          />

          <CategoryPicker
            categories={Object.keys(categorySums)}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />

          <SoldierPanel
            soldier={selectedSoldier}
            profile={currentProfile}
            readOnly={isReadOnly}
            saving={commentSaving}
            failed={commentFailed}
            onCommentSave={(value) => void saveComment(value)}
            onDetails={() => setDetailsOpen(true)}
          />

          <button className="link-button daily-button" type="button" onClick={() => setDailyDate(new Date())}>
            נוכחות יומית
          </button>

          {dailyDate && <DailyModal data={data} date={dailyDate} onDate={setDailyDate} onClose={() => setDailyDate(null)} />}
          {detailsOpen && selectedSoldier && (
            <DetailsModal
              data={data}
              soldier={selectedSoldier}
              profile={currentProfile}
              onClose={() => setDetailsOpen(false)}
            />
          )}
        </section>
      )}
    </main>
  );
}

function StatePanel({ title }: { title: string }) {
  return <section className="state-panel">{title}</section>;
}

function SkeletonLoader() {
  return (
    <section className="workspace skeleton-workspace" aria-label="טוען נתונים">
      <div className="skeleton skeleton-search" />
      <div className="calendar-panel skeleton-calendar">
        <div className="skeleton skeleton-nav" />
        <div className="weekdays">
          {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {Array.from({ length: 28 }, (_, idx) => (
            <div className="skeleton skeleton-day" key={idx} />
          ))}
        </div>
      </div>
      <div className="category-strip">
        {Array.from({ length: 4 }, (_, idx) => (
          <div className="skeleton skeleton-chip" key={idx} />
        ))}
      </div>
      <div className="soldier-panel">
        <div className="skeleton skeleton-line wide" />
        <div className="skeleton skeleton-textarea" />
      </div>
    </section>
  );
}

function Calendar(props: {
  dates: { date: Date; index: number }[];
  selectedSoldier: SelectedSoldier | null;
  sums: number[];
  missionTarget?: number;
  savingDays: Set<number>;
  failedDays: Set<number>;
  monthLabel: string;
  canGoPrev: boolean;
  canGoNext: boolean;
  readOnly: boolean;
  onPrev: () => void;
  onNext: () => void;
  onChange: (dayIndex: number, value?: PresenceValue) => void;
}) {
  const weekdays = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  const leadingBlanks = props.dates[0]?.date.getDay() || 0;
  const cells = [...Array.from({ length: leadingBlanks }, (_, idx) => ({ blank: true, key: `blank-${idx}` })), ...props.dates];

  return (
    <section className="calendar-panel">
      <div className="month-nav">
        <button className="ghost-button" type="button" disabled={!props.canGoPrev} onClick={props.onPrev}>
          הקודם
        </button>
        <strong>{props.monthLabel}</strong>
        <button className="ghost-button" type="button" disabled={!props.canGoNext} onClick={props.onNext}>
          הבא
        </button>
      </div>
      <div className="weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">
        {cells.map((cell) => {
          if ('blank' in cell) return <div className="calendar-empty" key={cell.key} />;
          const presence = normalizePresence(props.selectedSoldier?.presence[cell.index]);
          const count = props.sums[cell.index] || 0;
          const undercount = props.missionTarget != null && count < props.missionTarget;
          return (
            <PresenceCell
              key={cell.index}
              dayIndex={cell.index}
              date={cell.date}
              presence={presence}
              count={count}
              undercount={undercount}
              saving={props.savingDays.has(cell.index)}
              failed={props.failedDays.has(cell.index)}
              disabled={!props.selectedSoldier || props.readOnly}
              onChange={props.onChange}
            />
          );
        })}
      </div>
    </section>
  );
}

function PresenceCell(props: {
  dayIndex: number;
  date: Date;
  presence: PresenceValue;
  count: number;
  undercount: boolean;
  saving: boolean;
  failed: boolean;
  disabled: boolean;
  onChange: (dayIndex: number, value?: PresenceValue) => void;
}) {
  const pressStarted = useRef(0);
  const longPressFired = useRef(false);
  const suppressContextMenu = useRef(false);
  const className = [
    'calendar-day',
    props.presence && `presence-${props.presence}`,
    isToday(props.date) && 'today',
    props.failed && 'save-error',
  ]
    .filter(Boolean)
    .join(' ');

  function startPress(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pressStarted.current = Date.now();
    longPressFired.current = false;
    suppressContextMenu.current = false;
  }

  function endPress(event: React.PointerEvent<HTMLButtonElement>) {
    if (props.disabled) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const elapsed = Date.now() - pressStarted.current;
    if (elapsed >= 500) {
      longPressFired.current = true;
      suppressContextMenu.current = true;
      props.onChange(props.dayIndex, '');
      return;
    }
    if (!longPressFired.current) props.onChange(props.dayIndex);
  }

  return (
    <button
      className={className}
      type="button"
      disabled={props.disabled || props.saving}
      title={statusLabel(props.presence)}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerCancel={() => {
        pressStarted.current = 0;
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        if (suppressContextMenu.current) {
          suppressContextMenu.current = false;
          return;
        }
        if (!props.disabled) props.onChange(props.dayIndex, '');
      }}
    >
      <span className="date-text">{formatShortDate(props.date)}</span>
      <span className={props.undercount ? 'count undercount' : 'count'}>{props.count}</span>
      {props.saving && <span className="mini-loader" />}
    </button>
  );
}

function CategoryPicker(props: { categories: string[]; selected: string; onSelect: (category: string) => void }) {
  return (
    <section className="category-strip" aria-label="קטגוריות">
      {props.categories.map((category) => (
        <button
          key={category}
          className={props.selected === category ? 'chip selected' : 'chip'}
          type="button"
          onClick={() => props.onSelect(category)}
        >
          {category}
        </button>
      ))}
    </section>
  );
}

function SoldierPanel(props: {
  soldier: SelectedSoldier | null;
  profile?: { comment: string };
  readOnly: boolean;
  saving: boolean;
  failed: boolean;
  onCommentSave: (value: string) => void;
  onDetails: () => void;
}) {
  const [comment, setComment] = useState('');

  useEffect(() => {
    setComment(props.profile?.comment || '');
  }, [props.profile?.comment, props.soldier?.row]);

  if (!props.soldier) {
    return <section className="soldier-panel muted">בחר חייל כדי לעדכן נוכחות</section>;
  }

  return (
    <section className="soldier-panel">
      <div className="soldier-panel-head">
        <strong>{props.soldier.description}</strong>
        {props.profile && (
          <button className="ghost-button compact" type="button" onClick={props.onDetails}>
            פרטים
          </button>
        )}
      </div>
      <label>
        הערות
        <textarea
          className={props.failed ? 'save-error' : undefined}
          value={comment}
          disabled={props.readOnly}
          onChange={(event) => setComment(event.target.value)}
          onBlur={() => props.onCommentSave(comment)}
        />
      </label>
      {props.saving && <small>שומר הערה...</small>}
    </section>
  );
}

function DailyModal(props: { data: CompanyData; date: Date; onDate: (date: Date) => void; onClose: () => void }) {
  const daily = createDailyPresence(props.data, props.date);
  const total = daily.totalPresence + daily.totalHome + daily.totalSick + daily.totalArrangement;
  const inputValue = dateInputValue(props.date);

  function share() {
    const newline = '\n';
    let message = `*נוכחות יומית ${formatShortDate(props.date)}*${newline}${newline}`;
    message += `סהכ נוכחים: ${daily.totalPresence}${newline}`;
    message += `סהכ בחופשה: ${daily.totalHome}${newline}`;
    message += `סהכ במחלה: ${daily.totalSick}${newline}`;
    message += `סהכ בהתארגנות: ${daily.totalArrangement}${newline}${newline}`;

    daily.platoons.forEach((platoon) => {
      const group = daily.groups[platoon];
      message += `*[${platoon.length === 1 ? 'מחלקה' : 'מחלקת'} ${platoon}]*${newline}${newline}`;
      message += `*_נוכחים (${group.presence.length})_*${newline}${group.presence.join(newline)}${newline}${newline}`;
      if (group.home.length) message += `*_בחופשה (${group.home.length})_*${newline}${group.home.join(newline)}${newline}${newline}`;
      if (group.sick.length) message += `*_במחלה (${group.sick.length})_*${newline}${group.sick.join(newline)}${newline}${newline}`;
      if (group.arrangement.length) message += `*_התארגנות (${group.arrangement.length})_*${newline}${group.arrangement.join(newline)}${newline}${newline}`;
    });

    window.location.href = `whatsapp://send?text=${encodeURIComponent(message)}`;
  }

  return (
    <div className="modal-backdrop">
      <section className="modal-window">
        <button className="close-button" type="button" onClick={props.onClose} aria-label="סגירה">
          ×
        </button>
        <div className="modal-title">
          <h2>נוכחות יומית {formatShortDate(props.date)}</h2>
          <label className="date-picker-button" aria-label="בחירת תאריך">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="calendar-icon">
              <path d="M7 2v3" />
              <path d="M17 2v3" />
              <path d="M4 9h16" />
              <rect x="4" y="5" width="16" height="16" rx="2" />
            </svg>
            <input
              type="date"
              value={inputValue}
              onChange={(event) => {
                if (event.target.value) props.onDate(dateFromInput(event.target.value));
              }}
            />
          </label>
        </div>
        <div className="summary-line">
          סהכ {total} | נוכחים {daily.totalPresence} | חופשה {daily.totalHome} | מחלה {daily.totalSick} | התארגנות{' '}
          {daily.totalArrangement}
        </div>
        <button className="primary-button share-button" type="button" onClick={share}>
          שיתוף WhatsApp
        </button>
        <div className="platoon-list">
          {daily.platoons.map((platoon) => {
            const group = daily.groups[platoon];
            return (
              <details key={platoon} className="platoon-card">
                <summary>
                  <span>{platoon}</span>
                  <span>{group.presence.length + group.home.length + group.sick.length + group.arrangement.length} / {group.presence.length}</span>
                </summary>
                <PresenceList title="נוכחים" names={group.presence} />
                <PresenceList title="בחופשה" names={group.home} />
                <PresenceList title="במחלה" names={group.sick} />
                <PresenceList title="התארגנות" names={group.arrangement} />
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PresenceList({ title, names }: { title: string; names: string[] }) {
  if (!names.length) return null;
  return (
    <div className="presence-list">
      <strong>{title} ({names.length})</strong>
      <ul>{names.map((name) => <li key={name}>{name}</li>)}</ul>
    </div>
  );
}

function DetailsModal(props: {
  data: CompanyData;
  soldier: SelectedSoldier;
  profile?: {
    id: string;
    fullName: string;
    platoon: string;
    role: string;
    comment: string;
  };
  onClose: () => void;
}) {
  const todayIdx = Math.min(getDaysBetween(props.data.startDate, Date.now()), props.soldier.presence.length - 1);
  const counts = { total: 0, onsite: 0, home: 0, sick: 0, arrangement: 0 };
  for (let idx = 0; idx <= todayIdx; idx += 1) {
    const value = normalizePresence(props.soldier.presence[idx]);
    if (value) counts.total += 1;
    if (value === '1') counts.onsite += 1;
    if (value === '0') counts.home += 1;
    if (value === '2') counts.sick += 1;
    if (value === '3') counts.arrangement += 1;
  }

  const fallback = parseSoldierDescription(props.soldier.description);
  const items = [
    ['מ.א.', props.profile?.id],
    ['שם', props.profile?.fullName || fallback.name],
    ['מחלקה', props.profile?.platoon || fallback.platoon],
    ['תפקיד', props.profile?.role],
    ['יממ', counts.total],
    ['נוכח', counts.onsite],
    ['חופשה', counts.home],
    ['מחלה', counts.sick],
    ['התארגנות', counts.arrangement],
    ['הערות', props.profile?.comment],
  ];

  return (
    <div className="modal-backdrop">
      <section className="modal-window details-window">
        <button className="close-button" type="button" onClick={props.onClose} aria-label="סגירה">
          ×
        </button>
        <h2>פרטי חייל</h2>
        <dl className="details-list">
          {items.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || '[לא הוזן]'}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
