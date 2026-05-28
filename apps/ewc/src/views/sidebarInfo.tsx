/**
 * SidebarInfo — отображение выбранной карточки происшествия или empty state.
 * Props: selectedId (string | null), items (array).
 * Компонуется внутри Widget Sidebars.Main.
 */

interface SidebarInfoProps {
  selectedId?: string | null;
  items?: any[];
}

const SidebarInfo = View<SidebarInfoProps>((Ui, props) => {
  const items = props?.items ?? [];
  const selectedItem = props?.selectedId
    ? items.find((i: any) => i.id === props.selectedId)
    : undefined;

  return selectedItem ? (
    <Ui.Layout.Flex direction="col" gap="cell">
      <Ui.Layout.Flex direction="col" gap="cell">
        <Ui.Typography variant="muted" class="text-xs font-semibold">
          ID
        </Ui.Typography>
        <Ui.Typography>{selectedItem.id}</Ui.Typography>
      </Ui.Layout.Flex>

      <Ui.Layout.Flex direction="col" gap="cell">
        <Ui.Typography variant="muted" class="text-xs font-semibold">
          Заявитель
        </Ui.Typography>
        <Ui.Typography>{selectedItem.applicant.name}</Ui.Typography>
      </Ui.Layout.Flex>

      <Ui.Layout.Flex direction="col" gap="cell">
        <Ui.Typography variant="muted" class="text-xs font-semibold">
          Телефон
        </Ui.Typography>
        <Ui.Typography>{selectedItem.applicant.phone}</Ui.Typography>
      </Ui.Layout.Flex>

      <Ui.Layout.Flex direction="col" gap="cell">
        <Ui.Typography variant="muted" class="text-xs font-semibold">
          Координаты
        </Ui.Typography>
        <Ui.Typography>
          {selectedItem.location.lat}, {selectedItem.location.lng}
        </Ui.Typography>
      </Ui.Layout.Flex>

      <Ui.Layout.Flex direction="col" gap="cell">
        <Ui.Typography variant="muted" class="text-xs font-semibold">
          Описание
        </Ui.Typography>
        <Ui.Typography>{selectedItem.description}</Ui.Typography>
      </Ui.Layout.Flex>

      <Ui.Layout.Flex direction="col" gap="cell">
        <Ui.Typography variant="muted" class="text-xs font-semibold">
          Создано
        </Ui.Typography>
        <Ui.Typography>
          {new Date(selectedItem.createdAt).toLocaleString('ru-RU')}
        </Ui.Typography>
      </Ui.Layout.Flex>
    </Ui.Layout.Flex>
  ) : (
    <Ui.Typography variant="muted">
      Выберите карточку на карте или в таблице
    </Ui.Typography>
  );
});

export default SidebarInfo;
