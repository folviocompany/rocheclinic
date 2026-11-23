import { z } from 'zod';
import { normalizePhone } from './phone.ts';

export { formatPhone, normalizePhone } from './phone.ts';

export const clientFormSchema = z.object({
  id: z.uuid().optional(),
  fullName: z.string().trim().min(2, 'Informe o nome completo.').max(150, 'O nome deve ter até 150 caracteres.'),
  phone: z.string().trim().min(1, 'Informe o telefone.').refine((value) => {
    const digits = normalizePhone(value);
    return digits.length >= 10 && digits.length <= 13;
  }, 'Informe um telefone válido com DDD.'),
  birthDate: z.string().refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Informe uma data válida.'),
  referenceProfessionalId: z.union([z.literal(''), z.uuid()]),
  notes: z.string().trim().max(1000, 'As observações devem ter até 1000 caracteres.'),
  whatsappAllowed: z.boolean(),
  active: z.boolean(),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;
