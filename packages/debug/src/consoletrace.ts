import { Cmd } from "../cmd";
import { Program } from "../ui";

export function withConsoleTrace<Model, Msg extends { type: string }, InitProps, View>(app: Program<Model, Msg, InitProps, View, unknown>): Program<Model, Msg, InitProps, View, unknown> {
    return {
        ...app,
        onError: (model, msg, message: string, ex) => {
            console.error(msg, message, ex);

            if (app.onError) {
                return app.onError(model, msg, message, ex);
            }

            return Cmd.none;
        },
        update: (msg: Msg, model: Model): [Model, Cmd<Msg>] => {
            console.log(`Message received: ${msg.type}`, msg, model);
            const [newModel, cmd] = app.update(msg, model);
            console.log(`After update State`, model, cmd);
            return [newModel, cmd];
        }
    };
}