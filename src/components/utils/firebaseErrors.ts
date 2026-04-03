
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface DatabaseErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    name: string | undefined;
  }
}

export function handleDatabaseError(error: unknown, operationType: OperationType, path: string | null) {
  const savedProfile = localStorage.getItem('rahee_profile');
  const user = savedProfile ? JSON.parse(savedProfile) : null;

  const errInfo: DatabaseErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: user?.uid || user?.raheeKey,
      name: user?.name
    },
    operationType,
    path
  };
  console.error('Database Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
