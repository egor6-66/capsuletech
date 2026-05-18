const RendererDemo = Page((Ui, Widgets) => (
  <Ui.Layout
    variant={'centroid'}
    slots={{
      main: (
        <div class="grid grid-cols-2 gap-8 p-8 w-full max-w-5xl">
          <div class="flex flex-col items-center gap-4">
            <h3 class="text-sm uppercase tracking-wide opacity-60">Original (JSX)</h3>
            <Widgets.Forms.Auth />
          </div>
          <div class="flex flex-col items-center gap-4">
            <h3 class="text-sm uppercase tracking-wide opacity-60">
              Via @capsuletech/renderer (JSON)
            </h3>
            <Widgets.Demos.RendererAuth />
          </div>
        </div>
      ),
    }}
  />
));

export default RendererDemo;
