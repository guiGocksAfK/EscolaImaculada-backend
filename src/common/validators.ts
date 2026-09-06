import { Transform } from 'class-transformer';

/** Remove tudo que não for dígito (para CPF vindo formatado do front). */
export const SoDigitos = () =>
  Transform(({ value }) => String(value ?? '').replace(/\D/g, ''));

/** Regex de data ISO simples: YYYY-MM-DD. */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const CPF_REGEX = /^\d{11}$/;

/** Data de hoje no formato YYYY-MM-DD, no fuso local do servidor. */
export function hojeISO(): string {
  const d = new Date();
  const mes = `${d.getMonth() + 1}`.padStart(2, '0');
  const dia = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}
