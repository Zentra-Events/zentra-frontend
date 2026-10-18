import * as Yup from "yup";

export const getClientValidationSchema = () => {
    // Optional tax fields may come back as `null` from the API.
    // Normalize null -> "" so Yup.string() never throws "cannot be null".
    const optionalString = () =>
        Yup.string()
            .nullable()
            .transform(value => (value === null || value === undefined ? "" : value));

    return Yup.object({
        name: Yup.string().required("Name is required"),
        email: Yup.string().email("Invalid email").required("Email is required"),
        phone: Yup.string().required("Phone number is required"),
        address: Yup.string().required("Address is required"),
        poc: Yup.string().required("Point of contact is required"),
        gst: optionalString(),
        pan: optionalString(),
        gstCertificate: optionalString(),
        clientType: Yup.string()
            .oneOf(["CORPORATE", "PERSONAL", "OTHER"], "Please select a client type")
            .required("Client type is required"),
    });
};
