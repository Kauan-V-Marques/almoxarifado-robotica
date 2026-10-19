import { type NewMemberInput, newMemberSchema } from '@almox/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { ApiRequestError } from '../api/client';
import { useCreateMember, useMembers } from '../api/queries';
import { Badge, Button, Card, ErrorMessage, Field, Loading } from '../components/ui';

export function MembersPage() {
  const { data, isLoading } = useMembers();
  const create = useCreateMember();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewMemberInput, unknown, z.output<typeof newMemberSchema>>({
    resolver: zodResolver(newMemberSchema),
    defaultValues: { role: 'member' },
  });

  const onSubmit = handleSubmit(async (member) => {
    try {
      await create.mutateAsync(member);
      reset({ name: '', email: '', password: '', role: 'member' });
    } catch {
      // a mensagem da API aparece pelo create.error
    }
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card title="Equipe">
        {isLoading ? (
          <Loading />
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {data?.map((member) => (
              <li key={member.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-zinc-500">{member.email}</p>
                </div>
                <Badge tone={member.role === 'captain' ? 'orange' : 'gray'}>
                  {member.role === 'captain' ? 'Capitão' : 'Membro'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Cadastrar membro">
        <form onSubmit={onSubmit} className="flex flex-col gap-3 p-4" noValidate>
          <Field label="Nome" error={errors.name?.message} {...register('name')} />
          <Field label="E-mail" type="email" error={errors.email?.message} {...register('email')} />
          <Field
            label="Senha inicial"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          {create.error && <ErrorMessage>{(create.error as ApiRequestError).message}</ErrorMessage>}
          {create.isSuccess && <p className="text-sm text-emerald-700 dark:text-emerald-400">Membro cadastrado.</p>}
          <Button type="submit" disabled={isSubmitting}>
            Cadastrar
          </Button>
        </form>
      </Card>
    </div>
  );
}
