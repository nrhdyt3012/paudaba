import DialogDelete from "@/components/common/dialog-delete";
import { startTransition, useActionState, useEffect } from "react";
import { deleteMenu } from "../actions";
import { INITIAL_STATE_ACTION } from "@/constants/general-constant";
import { toast } from "sonner";
import { Menu } from "@/validations/menu-validation";

export default function DialogDeleteMenu({
  open,
  refetch,
  currentData,
  handleChangeAction,
}: {
  refetch: () => void;
  currentData?: Menu;
  open: boolean;
  handleChangeAction: (open: boolean) => void;
}) {
  const [state, action, isPending] = useActionState(deleteMenu, INITIAL_STATE_ACTION);

  const onSubmit = () => {
    const formData = new FormData();
    formData.append("id", currentData!.id_masterTagihan!.toString());
    startTransition(() => { action(formData); });
  };

  useEffect(() => {
    if (state?.status === "error") {
      toast.error("Gagal Menghapus", { description: state.errors?._form?.[0] });
    }
    if (state?.status === "success") {
      toast.success("Master tagihan berhasil dihapus");
      handleChangeAction?.(false);
      refetch();
    }
  }, [state]);

  return (
    <DialogDelete
      open={open}
      onOpenChange={handleChangeAction}
      isLoading={isPending}
      onSubmit={onSubmit}
      title="Master Tagihan"
    />
  );
}