import { Program, Cmd, Dispatch } from "uilib";

type Rerender = {
    type: "Rerender"
}
function Rerender(): Rerender {
    return {
        type: "Rerender"
    }
}
type Msg<ParentMsg> = (
| Rerender
| ParentMsg
)

export function withHMR<Model, ParentMsg extends { type: string }, InitProps, View, ExternalMessage>(app: Program<Model, ParentMsg, InitProps, View, ExternalMessage>): Program<Model, Msg<ParentMsg>, InitProps, View, ExternalMessage> {
    let outerDispatch: Dispatch<Msg<ParentMsg>> | undefined = undefined;

    
    // hot(import.meta.url).accept(["./app.bundle.js"], () => {
    //     if (outerDispatch) {
    //         outerDispatch(Rerender())
    //     }
    // })
    return {
        ...app,
        update: (msg: Msg<ParentMsg>, model: Model) => {
            switch (msg.type) {
                case "Rerender":
                    return [model, Cmd.none]
                default:
                    return app.update(<ParentMsg>msg, model)
            }
        },
        subscribe: (model: Model): Cmd<Msg<ParentMsg>> => {
            const sub = Cmd.ofSub<Msg<ParentMsg>>((dispatch: Dispatch<Msg<ParentMsg>>) => {
                outerDispatch = dispatch
            })
            if (app.subscribe) {
                const parentSub = app.subscribe(model)
                return Cmd.batch<Msg<ParentMsg>>([sub, parentSub])
            }
            return sub
        }
    };
}