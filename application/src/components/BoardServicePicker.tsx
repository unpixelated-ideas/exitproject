import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ServiceBullet } from './ServiceBullet';

type ServiceOption = { value: string; routes: string[]; label?: string };

export function BoardServicePicker({ value, groups, routes, onSelect }: {
  value: string;
  groups: ServiceOption[];
  routes: string[];
  onSelect: (value: string) => void;
}) {
  const { t } = useTranslation();
  const picker = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const all = { value: 'all', routes: [], label: t('board.allServices') };
  const individual = routes.map(route => ({ value: route, routes: [route] }));
  const current = [all, ...groups, ...individual].find(option => option.value === value) ?? all;

  function close() {
    if (picker.current) picker.current.open = false;
    trigger.current?.focus();
  }

  function optionContent(option: ServiceOption) {
    return <>
      <span className="board-picker-bullets">{option.routes.map(route => <ServiceBullet key={route} id={route} />)}</span>
      {option.label && <span>{option.label}</span>}
    </>;
  }

  function optionButton(option: ServiceOption) {
    return <button key={option.value} type="button" aria-pressed={option.value === current.value}
      onClick={() => { onSelect(option.value); close(); }}>{optionContent(option)}</button>;
  }

  return <div className="board-service-field">
    <span id="board-service-label">{t('board.service')}</span>
    <details className="board-service-picker" ref={picker} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
    }} onKeyDown={event => {
      if (event.key === 'Escape' && picker.current?.open) {
        event.preventDefault();
        close();
      }
    }}>
      <summary ref={trigger} aria-labelledby="board-service-label board-service-value">
        <span id="board-service-value">{optionContent(current)}</span>
      </summary>
      <div className="board-service-options">
        {optionButton(all)}
        {groups.length > 0 && <div role="group" aria-label={t('board.platformGroups')}>
          <div className="board-picker-group-label">{t('board.platformGroups')}</div>
          {groups.map(optionButton)}
        </div>}
        {individual.length > 0 && <div role="group" aria-label={t('board.individualServices')}>
          <div className="board-picker-group-label">{t('board.individualServices')}</div>
          {individual.map(optionButton)}
        </div>}
      </div>
    </details>
  </div>;
}
