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
  operatingDays: z.array(z.string()).min(1, 'Select at least one operating day'),
  hours: z.record(
    z.string(), // Day
    z.object({
      open: z.string(),
      close: z.string(),
      lastOrder: z.string(),
    })
  ),

  // Step 3
  currency: z.string().min(1, 'Currency is required'),
  timezone: z.string().min(1, 'Timezone is required'),
  kdsEnabled: z.boolean(),
  kotAutoPrint: z.boolean(),
  acceptOnlineOrders: z.boolean(),
  deliveryAvailable: z.boolean(),
});

export type AddBranchFormData = z.infer<typeof addBranchSchema>;

export function useAddBranch(onClose: () => void) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const { addBranchMutation } = useBranches();

  const methods = useForm<AddBranchFormData>({
    resolver: zodResolver(addBranchSchema),
    defaultValues: {
      name: '',
      address: '',
      city: '',
      phone: '',
      email: '',
      operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      hours: {
        Mon: { open: '09:00', close: '23:00', lastOrder: '22:30' },
        Tue: { open: '09:00', close: '23:00', lastOrder: '22:30' },
        Wed: { open: '09:00', close: '23:00', lastOrder: '22:30' },
        Thu: { open: '09:00', close: '23:00', lastOrder: '22:30' },
        Fri: { open: '09:00', close: '23:00', lastOrder: '22:30' },
        Sat: { open: '09:00', close: '23:00', lastOrder: '22:30' },
        Sun: { open: '09:00', close: '23:00', lastOrder: '22:30' },
      },
      currency: 'PKR',
      timezone: 'Asia/Karachi',
      kdsEnabled: true,
      kotAutoPrint: true,
      acceptOnlineOrders: true,
      deliveryAvailable: false,
    },
    mode: 'onTouched'
  });

  const goNext = async () => {
    let fieldsToValidate: (keyof AddBranchFormData)[] = [];
    
    if (currentStep === 1) {
      fieldsToValidate = ['name', 'address', 'city', 'phone', 'email'];
    } else if (currentStep === 2) {
      fieldsToValidate = ['operatingDays', 'hours'];
    } else if (currentStep === 3) {
      fieldsToValidate = ['currency', 'timezone', 'kdsEnabled', 'kotAutoPrint', 'acceptOnlineOrders', 'deliveryAvailable'];
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

  const onSubmit = async (data: AddBranchFormData) => {
    try {
      // Pick the opening and closing time from the first selected operating day
      const firstDay = data.operatingDays[0];
      let openingTime = '09:00';
      let closingTime = '23:00';
      
      if (firstDay && data.hours[firstDay]) {
        openingTime = data.hours[firstDay].open;
        closingTime = data.hours[firstDay].close;
      }

      const payload = {
        name: data.name,
        address: data.address,
        city: data.city,
        country: 'Pakistan',
        phone: data.phone,
        email: data.email,
        openingTime,
        closingTime,
        currency: data.currency,
        timezone: data.timezone,
        taxRate: 15, // Default tax rate
        kdsEnabled: data.kdsEnabled,
        kotAutoPrint: data.kotAutoPrint,
      };

      await addBranchMutation.mutateAsync(payload);
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
    onSubmit: methods.handleSubmit(onSubmit),
    isSubmitting: addBranchMutation.isPending
  };
}
