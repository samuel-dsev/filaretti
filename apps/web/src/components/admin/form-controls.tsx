'use client';

import { useId } from 'react';
import { FormField, Input, Textarea, Select } from '@filaretti/ui';

export function TextField({
  label,
  value,
  onChange,
  required,
  maxLength,
  help,
  multiline = false,
  type = 'text',
  disabled = false,
}: {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  required?: boolean;
  maxLength?: number;
  help?: string;
  multiline?: boolean;
  type?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <FormField id={id} label={label} required={required} help={help}>
      {(props) =>
        multiline ? (
          <Textarea
            {...props}
            disabled={disabled}
            value={value ?? ''}
            maxLength={maxLength}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <Input
            {...props}
            disabled={disabled}
            type={type}
            value={value ?? ''}
            maxLength={maxLength}
            onChange={(event) => onChange(event.target.value)}
          />
        )
      }
    </FormField>
  );
}
export function ChoiceField({
  label,
  value,
  onChange,
  options,
  required,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
  required?: boolean;
  help?: string;
}) {
  const id = useId();
  return (
    <FormField id={id} label={label} required={required} help={help}>
      {(props) => (
        <Select {...props} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Selecione</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>
      )}
    </FormField>
  );
}
export function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <label className="cms-check" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
export function RelationFields({
  label,
  values,
  onChange,
  options,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: { id: string; name: string; isActive?: boolean }[];
}) {
  return (
    <fieldset className="cms-relations">
      <legend>{label}</legend>
      {options.length ? (
        <div>
          {options.map((option) => (
            <CheckField
              key={option.id}
              label={`${option.name}${option.isActive === false ? ' (inativo)' : ''}`}
              checked={values.includes(option.id)}
              onChange={(checked) =>
                onChange(checked ? [...values, option.id] : values.filter((id) => id !== option.id))
              }
            />
          ))}
        </div>
      ) : (
        <p>Nenhum registro disponível.</p>
      )}
    </fieldset>
  );
}
export function LinesField({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <TextField
      label={label}
      value={values.join('\n')}
      multiline
      help="Um item por linha, até 50 itens de 400 caracteres."
      onChange={(value) => onChange(value.split('\n'))}
    />
  );
}
