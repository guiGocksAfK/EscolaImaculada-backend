import { Transform } from 'class-transformer';

/** Remove tudo que não for dígito (para CPF vindo formatado do front). */
export const SoDigitos = () =>
  Transform(({ value }) => String(value ?? '').replace(/\D/g, ''));

/** Regex de data ISO simples: YYYY-MM-DD. */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const CPF_REGEX = /^\d{11}$/;
