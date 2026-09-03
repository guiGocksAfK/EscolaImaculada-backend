import { SetMetadata } from '@nestjs/common';

import { Papel } from '../generated/prisma/client.js';

export const ROLES_KEY = 'roles';

/** Restringe o handler/controller aos papéis informados. Requer RolesGuard. */
export const Roles = (...papeis: Papel[]) => SetMetadata(ROLES_KEY, papeis);
