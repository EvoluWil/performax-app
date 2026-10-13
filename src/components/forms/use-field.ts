import { type FieldPath, type FieldValues, useController, type UseControllerProps } from 'react-hook-form';

export function useField<T extends FieldValues, TName extends FieldPath<T>>(props: UseControllerProps<T, TName>) {
  const { field, fieldState, formState } = useController(props);
  return {
    field,
    message: fieldState.error?.message,
    locked: Boolean(formState.isSubmitting || props.disabled),
  };
}
