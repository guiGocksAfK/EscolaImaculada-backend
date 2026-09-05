import { Transform } from 'class-transformer';
import { registerDecorator, ValidationOptions } from 'class-validator';

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

// ---------------------------------------------------------------------------
// CPF
// ---------------------------------------------------------------------------

/** Valida CPF de verdade: 11 dígitos + dígitos verificadores. */
export function cpfValido(cpf: string): boolean {
  if (!CPF_REGEX.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // 000..., 111..., etc.

  const digito = (base: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  if (digito(cpf.slice(0, 9), 10) !== Number(cpf[9])) return false;
  if (digito(cpf.slice(0, 10), 11) !== Number(cpf[10])) return false;
  return true;
}

/**
 * @IsCpf() — CPF com dígitos verificadores válidos. Use depois de
 * @SoDigitos(). `opcional: true` aceita string vazia (aluno sem CPF).
 */
export function IsCpf(
  opts: { opcional?: boolean } = {},
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isCpf',
      target: object.constructor,
      propertyName,
      options: { message: 'CPF inválido', ...validationOptions },
      validator: {
        validate(value: unknown): boolean {
          if (opts.opcional && (value === '' || value === null || value === undefined)) {
            return true;
          }
          return typeof value === 'string' && cpfValido(value);
        },
      },
    });
  };
}

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

/**
 * Data ISO (YYYY-MM-DD) que existe de fato no calendário e está numa faixa
 * sensata. `futuro: false` (padrão) rejeita datas depois de hoje.
 */
export function dataRazoavel(
  valor: string,
  { futuro = false }: { futuro?: boolean } = {},
): boolean {
  if (!ISO_DATE.test(valor)) return false;

  const [ano, mes, dia] = valor.split('-').map(Number);
  const d = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  // Rejeita 2026-02-31 (o Date "rola" para março).
  if (d.getFullYear() !== ano || d.getMonth() + 1 !== mes || d.getDate() !== dia) {
    return false;
  }

  const anoAtual = new Date().getFullYear();
  if (ano < 1900 || ano > anoAtual + (futuro ? 5 : 0)) return false;

  if (!futuro) {
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    if (d.getTime() > hoje.getTime()) return false;
  }
  return true;
}

/**
 * @IsDataRazoavel() — data ISO válida no calendário, ano ≥ 1900 e (por
 * padrão) não futura.
 */
export function IsDataRazoavel(
  opts: { futuro?: boolean } = {},
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isDataRazoavel',
      target: object.constructor,
      propertyName,
      options: {
        message: opts.futuro
          ? 'data inválida (use YYYY-MM-DD)'
          : 'data inválida ou no futuro (use YYYY-MM-DD)',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && dataRazoavel(value, opts);
        },
      },
    });
  };
}
