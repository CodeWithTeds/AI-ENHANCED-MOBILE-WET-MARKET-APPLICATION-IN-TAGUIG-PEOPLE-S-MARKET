import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';

export function useFlashToast() {
    const { flash } = usePage().props as { flash?: { success?: string; warning?: string; error?: string } };

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }

        if (flash?.warning) {
            toast.warning(flash.warning, { duration: 15000 });
        }

        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash?.success, flash?.warning, flash?.error]);
}
