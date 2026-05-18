const Picker = Controller(() => ({
  initial: 'idle',
  states: {
    idle: {
      onClick: async ({ target, next }: any) => {
        const tags = target?.meta?.tags ?? [];
        const name = (target?.payload as any)?.name;
        if (!name) return;

        const action = tags.includes('btn-load')
          ? 'load'
          : tags.includes('btn-unload')
            ? 'unload'
            : tags.includes('btn-delete')
              ? 'delete'
              : tags.includes('btn-pull')
                ? 'pull'
                : tags.includes('model-activate')
                  ? 'activate'
                  : null;

        if (!action) return;
        await next.with({ action, name });
      },
    },
  },
}));

export default Picker;
