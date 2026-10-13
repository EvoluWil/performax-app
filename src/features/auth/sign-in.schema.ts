import * as yup from 'yup';

export const signInSchema = yup.object({
  email: yup.string().trim().required('Informe o e-mail.').email('Informe um e-mail válido.'),
  password: yup.string().required('Informe a senha.'),
});

export type SignInValues = yup.InferType<typeof signInSchema>;
