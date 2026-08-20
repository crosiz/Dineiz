import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useBranches } from '../../hooks/useBranches';

export const addBranchSchema = z.object({
  // Step 1
  name: z.string().min(2, 'Name must be at least 2 characters'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  city: z.string().min(2, 'City is required'),
  phone: z.string().min(8, 'Valid phone number is required'),
  email: z.string().email('Valid email is required').optional().or(z.literal('')),
  logo: z.any().optional(),

  // Step 2
  openingTime: z.string().min(1, 'Opening time is required'),
  closingTime: z.string().min(1, 'Closing time is required'),

  // Step 3
  currency: z.string().min(1, 'Currency is required'),
  timezone: z.string().min(1, 'Timezone is required'),
  taxRate: z.coerce.number().min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100%'),
  kdsEnabled: z.boolean(),
  kotAutoPrint: z.boolean(),
});

export type AddBranchFormData = z.infer<typeof addBranchSchema>;

export function useAddBranch(onClose: () => void) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const { addBranchMutation, uploadImageMutation } = useBranches();

  const methods = useForm<AddBranchFormData>({
    resolver: zodResolver(addBranchSchema),
    defaultValues: {
      name: '',
      address: '',
      city: '',
      phone: '',
      email: '',
      openingTime: '09:00',
      closingTime: '23:00',
      currency: 'PKR',
      timezone: 'Asia/Karachi',
      taxRate: 0,
      kdsEnabled: true,
      kotAutoPrint: true,
    },
    mode: 'onTouched'
  });

  const goNext = async () => {
    let fieldsToValidate: (keyof AddBranchFormData)[] = [];
    
    if (currentStep === 1) {
      fieldsToValidate = ['name', 'address', 'city', 'phone', 'email'];
    } else if (currentStep === 2) {
      fieldsToValidate = ['openingTime', 'closingTime'];
    } else if (currentStep === 3) {
      fieldsToValidate = ['currency', 'timezone', 'taxRate', 'kdsEnabled', 'kotAutoPrint'];
    }

    const isValid = await methods.trigger(fieldsToValidate);
    
    if (isValid && currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3 | 4);
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    }
  };

  const goToStep = (step: 1 | 2 | 3 | 4) => {
    setCurrentStep(step);
  };

  const onSubmit = async (data: AddBranchFormData) => {
    try {
      const payload = {
        name: data.name,
        address: data.address,
        city: data.city,
        country: 'Pakistan',
        phone: data.phone,
        email: data.email,
        openingTime: data.openingTime,
        closingTime: data.closingTime,
        currency: data.currency,
        timezone: data.timezone,
        taxRate: data.taxRate,
        kdsEnabled: data.kdsEnabled,
        kotAutoPrint: data.kotAutoPrint,
      };

      const result: any = await addBranchMutation.mutateAsync(payload);

      const logoFile: File | undefined = (data.logo as FileList | undefined)?.[0];
      if (logoFile && result?.branch?.id) {
        try {
          await uploadImageMutation.mutateAsync({ id: result.branch.id, file: logoFile });
        } catch {
          toast.error('Branch created, but the logo failed to upload — you can add it later from Edit Branch.');
        }
      }

      toast.success('Branch created successfully');
      onClose();
    } catch (e: any) {
      if (e.message === 'PLAN_LIMIT_REACHED') {
        // Here we could open an upgrade modal instead, for now just show a special toast
        toast.error(`Plan Limit Reached: Upgrade your plan to add more branches.`, { duration: 6000 });
        onClose();
      } else {
        toast.error('Failed to create branch');
      }
    }
  };

  return {
    methods,
    currentStep,
    goNext,
    goBack,
    goToStep,
    onSubmit: methods.handleSubmit(onSubmit),
    isSubmitting: addBranchMutation.isPending
  };
}
