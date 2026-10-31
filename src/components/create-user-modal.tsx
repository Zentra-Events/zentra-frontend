import { Formik, Form } from "formik";

import { FormikFieldInput } from "@/components/ui/formik-field-input";
import { FormikFieldSelect } from "@/components/ui/formik-field-select";
import { useRequestApi } from "@/hooks/useRequestApi";
import { Modal, ModalFooter, ModalBody } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { getValidationSchema } from "@/lib/validations/user";
import { User } from "@/types/user";
import { userFormInitialValues, userRoleOptions } from "@/constants/user";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { toast } from "sonner";

interface CreateUserModalProps {
    open: boolean;
    onClose: () => void;
    user?: User | null;
    onSuccess?: () => void;
}

export default function CreateUserModal({ open, onClose, user, onSuccess }: CreateUserModalProps) {
    const { request, loading, error } = useRequestApi();

    const isEditMode = Boolean(user?.id);

    const handleSubmit = async (
        values: User,
        { setSubmitting }: { setSubmitting: (isSubmitting: boolean) => void },
    ) => {
        const { name, uid, email, phone, role, password } = values;
        const body = { name, uid, email, phone, role };
        try {
            let result;
            if (isEditMode) {
                result = await request(`${API_ENDPOINTS.users}/${user!.id}`, {
                    method: "PUT",
                    body,
                });
            } else {
                result = await request(API_ENDPOINTS.users, {
                    method: "POST",
                    body: { ...body, password },
                });
            }
            if (result === null) {
                toast.error(
                    `Failed to ${isEditMode ? "update" : "create"} user. Please try again. ${error}`,
                );
                return;
            }

            if (onSuccess) onSuccess();
            toast.success(`User ${isEditMode ? "updated" : "created"} successfully!`);
            onClose();
        } catch {
        } finally {
            setSubmitting(false);
        }
    };

    const validationSchema = getValidationSchema(Boolean(user));

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={user ? "Edit User" : "Create User"}
            size="lg"
            description="Create a new user profile and set initial access credentials."
        >
            <Formik
                initialValues={user ? { ...user, password: "" } : userFormInitialValues}
                onSubmit={handleSubmit}
                validationSchema={validationSchema}
                validateOnMount={false}
            >
                {() => (
                    <Form className="grid gap-3">
                        <ModalBody className="grid gap-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <FormikFieldInput
                                    name="name"
                                    label="Name"
                                    placeholder="Full Name"
                                />
                                <FormikFieldInput
                                    name="uid"
                                    label="Username"
                                    placeholder="Username"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <FormikFieldInput
                                    name="password"
                                    label="Password"
                                    type="text"
                                    placeholder="Password"
                                    disabled={Boolean(user)}
                                />
                                <FormikFieldInput
                                    name="phone"
                                    label="Phone Number"
                                    placeholder="Phone Number"
                                />
                            </div>
                            <FormikFieldInput
                                name="email"
                                label="Email"
                                type="email"
                                placeholder="Email"
                            />
                            {/* Super admin role cannot be changed */}
                            <FormikFieldSelect
                                name="role"
                                label="Role"
                                options={userRoleOptions}
                                placeholder="Select role"
                                isDisabled={user?.role?.toLowerCase() === "super_admin"}
                            />
                            {user?.role?.toLowerCase() === "super_admin" && (
                                <p className="text-xs text-muted-foreground">
                                    Super admin role cannot be changed.
                                </p>
                            )}
                        </ModalBody>
                        <ModalFooter>
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button isLoading={loading} type="submit">
                                {user ? "Save" : "Create"}
                            </Button>
                        </ModalFooter>
                    </Form>
                )}
            </Formik>
        </Modal>
    );
}
